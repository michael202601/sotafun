import cron, { ScheduledTask } from 'node-cron';
import type { AppContext } from '../app/context';
import type { CheckIn, Employee } from '@prisma/client';
import { getLogger } from '../utils/logger';
import { GoogleChatService } from '../google-chat/chat.service';

const logger = getLogger('scheduler');

/**
 * Core scheduling engine. Runs a lightweight tick every minute to create
 * check-ins and drive reminders/timeouts. All durable state lives in the DB,
 * so the scheduler recovers automatically after a restart.
 */
export class SchedulerService {
  private task: ScheduledTask | null = null;
  private running = false;
  /** Business day the session-start prompt was already posted for. */
  private sessionStartDay: string | null = null;

  constructor(
    private readonly ctx: AppContext,
    private readonly onReport: () => Promise<void>,
  ) {}

  start(): void {
    // Every minute (docs: do not rely on Linux cron, use node-cron).
    this.task = cron.schedule('* * * * *', () => {
      void this.tick();
    });
    logger.info('Scheduler started');
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
  }

  /** One scheduling tick. Guarded so overlapping runs never stack up. */
  async tick(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.maybeRunSessionStart();
      await this.createDueCheckIns(now);
      await this.processReminders(now);
      await this.maybeRunReport(now);
    } catch (err) {
      logger.error('Scheduler tick failed', { error: (err as Error).message });
    } finally {
      this.running = false;
    }
  }

  // --- Check-in creation -------------------------------------------------

  private async createDueCheckIns(now: Date): Promise<void> {
    if (!this.ctx.time.canScheduleCheckIn(now)) return;

    const interval = this.ctx.env.CHECK_INTERVAL;
    const slots = this.ctx.time.checkInSlots(now, interval);
    // The single slot due in this tick window: now-interval < slot <= now.
    const windowStart = now.getTime() - interval * 60 * 1000;
    const due = slots.filter((s) => s.at.getTime() <= now.getTime() && s.at.getTime() > windowStart);
    if (!due.length) return;

    const employees = await this.ctx.employees.listEnabled();
    for (const slot of due) {
      for (const employee of employees) {
        await this.openCheckIn(employee, slot.at);
      }
    }
  }

  private async openCheckIn(employee: Employee, scheduledTime: Date): Promise<void> {
    if (!employee.googleChatUserId) return; // cannot DM without a user id
    if (await this.ctx.checkIns.existsForSlot(employee.id, scheduledTime)) return;

    // Check-ins go to the employee's DM so they can reply naturally (no @mention).
    const dmSpace = await this.ctx.chat.findDirectMessage(employee.googleChatUserId);
    if (!dmSpace) {
      // The employee must message the bot once to open the DM. Don't create an
      // orphan check-in until we have somewhere to send it.
      logger.info('Skip check-in: no DM with employee yet', { employee: employee.name });
      return;
    }

    const checkIn = await this.ctx.checkIns.createForSlot(employee.id, scheduledTime);
    if (!checkIn) return; // race -> already created

    try {
      const content = await this.ctx.ai.generateCheckIn(employee.id);
      const sent = await this.ctx.chat.sendNewThread(dmSpace, content.message);
      await this.ctx.checkIns.markSent(checkIn.id, sent.messageId, sent.threadId);
      await this.ctx.checkIns.addMessage(checkIn.id, 'BOT', content.message);
      logger.info('Check-in sent (DM)', { employee: employee.name, category: content.category });
    } catch (err) {
      logger.error('Failed to send check-in', {
        employee: employee.name,
        error: (err as Error).message,
      });
    }
  }

  // --- Reminders & timeouts ---------------------------------------------

  private thresholds(): { r1: number; r2: number; r3: number; missed: number } {
    const f = this.ctx.env.FIRST_REMINDER;
    const s = this.ctx.env.SECOND_REMINDER;
    const t = this.ctx.env.THIRD_REMINDER;
    return { r1: f, r2: f + s, r3: f + s + t, missed: f + s + t + t };
  }

  private async processReminders(now: Date): Promise<void> {
    if (this.ctx.time.isUsWeekend(now)) return; // stay silent on US weekends
    const active = await this.ctx.checkIns.findActive();
    for (const checkIn of active) {
      if (!checkIn.firstMessageTime) continue; // not sent yet
      await this.advanceReminder(checkIn, now);
    }
  }

  private async advanceReminder(checkIn: CheckIn, now: Date): Promise<void> {
    const elapsedMin = (now.getTime() - checkIn.firstMessageTime!.getTime()) / 60000;
    const { r1, r2, r3, missed } = this.thresholds();

    const reminders = await this.ctx.checkIns.listReminders(checkIn.id);
    const sentLevels = new Set(reminders.map((r) => r.level));

    if (elapsedMin >= missed) {
      await this.ctx.checkIns.markMissed(checkIn.id);
      await this.ctx.checkIns.addMessage(checkIn.id, 'SYSTEM', 'Marked as MISSED (timeout)');
      logger.info('Check-in missed', { checkInId: checkIn.id });
      return;
    }

    let level: 1 | 2 | 3 | null = null;
    if (elapsedMin >= r3 && !sentLevels.has(3)) level = 3;
    else if (elapsedMin >= r2 && !sentLevels.has(2)) level = 2;
    else if (elapsedMin >= r1 && !sentLevels.has(1)) level = 1;
    if (!level) return;

    await this.sendReminder(checkIn, level);
  }

  private async sendReminder(checkIn: CheckIn, level: 1 | 2 | 3): Promise<void> {
    // Reserve the slot first (unique constraint) to guarantee no duplicates,
    // even across restarts or overlapping ticks.
    const message = await this.ctx.ai.generateReminder(level);
    const employee = await this.ctx.employees.findById(checkIn.employeeId);
    const dmSpace = employee?.googleChatUserId
      ? await this.ctx.chat.findDirectMessage(employee.googleChatUserId)
      : null;

    const reserved = await this.ctx.checkIns.addReminder(checkIn.id, level, message);
    if (!reserved) return; // already sent

    try {
      if (dmSpace) {
        // Reply in the same DM thread as the check-in (falls back to a new
        // message when the DM is unthreaded).
        await this.ctx.chat.replyInThread(dmSpace, checkIn.conversationId ?? '', message);
      }
      await this.ctx.checkIns.setState(checkIn.id, `REMINDER_${level}` as const);
      await this.ctx.checkIns.addMessage(checkIn.id, 'BOT', message);
      logger.info('Reminder sent', { checkInId: checkIn.id, level });
    } catch (err) {
      logger.error('Failed to send reminder', {
        checkInId: checkIn.id,
        level,
        error: (err as Error).message,
      });
    }
  }

  // --- Session start: onboard employees without a DM --------------------

  /**
   * At the start of the work session, post one message to the shared group that
   * @mentions any enabled employee who has not opened a DM with the bot yet,
   * asking them to message it once so check-ins can be delivered privately.
   */
  private async maybeRunSessionStart(): Promise<void> {
    const business = this.ctx.time.nowBusiness();
    if (business.toFormat('HH:mm') !== this.ctx.env.WORK_START) return;
    if (this.ctx.time.isUsWeekend()) return;

    const day = business.toFormat('yyyy-MM-dd');
    if (this.sessionStartDay === day) return; // already posted today
    this.sessionStartDay = day;

    const employees = await this.ctx.employees.listEnabled();
    const missing: Employee[] = [];
    for (const employee of employees) {
      if (!employee.googleChatUserId) continue;
      const dm = await this.ctx.chat.findDirectMessage(employee.googleChatUserId);
      if (!dm) missing.push(employee);
    }
    if (!missing.length) return;

    const mentions = missing
      .map((e) => GoogleChatService.mention(e.googleChatUserId, e.name))
      .join(' ');
    const text =
      `🌅 Chào buổi làm việc mới! ${mentions} ơi, để mình gửi check-in riêng cho bạn, ` +
      `bạn nhắn cho mình (Lisa) một tin bất kỳ trong chat riêng nhé — chỉ cần 1 lần thôi 😄`;
    try {
      await this.ctx.chat.sendNewThread(this.ctx.env.GOOGLE_CHAT_EMPLOYEE_SPACE, text);
      logger.info('Posted session-start DM prompt', { count: missing.length });
    } catch (err) {
      logger.error('Failed to post session-start prompt', { error: (err as Error).message });
    }
  }

  // --- Daily report trigger ---------------------------------------------

  private async maybeRunReport(now: Date): Promise<void> {
    if (this.ctx.time.isUsWeekend(now)) return; // no report on US weekends
    const business = this.ctx.time.nowBusiness();
    const hhmm = business.toFormat('HH:mm');
    if (hhmm !== this.ctx.env.REPORT_TIME) return;
    logger.info('Report time reached', { time: hhmm });
    await this.onReport();
  }
}
