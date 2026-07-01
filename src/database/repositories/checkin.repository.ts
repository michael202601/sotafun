import type { CheckIn, MessageHistory, PrismaClient, Reminder } from '@prisma/client';
import { withRetry } from '../client';

export type CheckInStatus = 'OPEN' | 'RESPONDED' | 'MISSED' | 'EXPIRED';
export type CheckInState =
  | 'IDLE'
  | 'WAITING'
  | 'REMINDER_1'
  | 'REMINDER_2'
  | 'REMINDER_3'
  | 'RESPONDED'
  | 'MISSED'
  | 'EXPIRED';

/** Access to check-ins, reminders and message history. */
export class CheckInRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Create a check-in for an employee at a scheduled slot (idempotent per slot). */
  async createForSlot(employeeId: string, scheduledTime: Date): Promise<CheckIn | null> {
    try {
      return await this.prisma.checkIn.create({
        data: { employeeId, scheduledTime, status: 'OPEN', state: 'IDLE' },
      });
    } catch {
      // Unique constraint (employeeId, scheduledTime) -> slot already exists.
      return null;
    }
  }

  async existsForSlot(employeeId: string, scheduledTime: Date): Promise<boolean> {
    const row = await withRetry(
      () =>
        this.prisma.checkIn.findUnique({
          where: { employeeId_scheduledTime: { employeeId, scheduledTime } },
        }),
      'checkIn.existsForSlot',
    );
    return row !== null;
  }

  async findById(id: string): Promise<CheckIn | null> {
    return withRetry(() => this.prisma.checkIn.findUnique({ where: { id } }), 'checkIn.findById');
  }

  /** Open check-ins whose message was sent (used for reminder/timeout ticks). */
  async findActive(): Promise<CheckIn[]> {
    return withRetry(
      () => this.prisma.checkIn.findMany({ where: { status: 'OPEN' } }),
      'checkIn.findActive',
    );
  }

  /** OPEN check-in owning a given Google Chat thread (used to attach a reply). */
  async findOpenByThread(conversationId: string): Promise<CheckIn | null> {
    return withRetry(
      () =>
        this.prisma.checkIn.findFirst({
          where: { conversationId, status: 'OPEN' },
          orderBy: { scheduledTime: 'desc' },
        }),
      'checkIn.findOpenByThread',
    );
  }

  /** Latest OPEN check-in for an employee (used by the /status command). */
  async findOpenForEmployee(employeeId: string): Promise<CheckIn | null> {
    return withRetry(
      () =>
        this.prisma.checkIn.findFirst({
          where: { employeeId, status: 'OPEN', firstMessageTime: { not: null } },
          orderBy: { scheduledTime: 'desc' },
        }),
      'checkIn.findOpenForEmployee',
    );
  }

  async markSent(id: string, messageId: string, conversationId: string): Promise<void> {
    await withRetry(
      () =>
        this.prisma.checkIn.update({
          where: { id },
          data: {
            firstMessageTime: new Date(),
            messageId,
            conversationId,
            state: 'WAITING',
          },
        }),
      'checkIn.markSent',
    );
  }

  async setState(id: string, state: CheckInState): Promise<void> {
    await withRetry(
      () => this.prisma.checkIn.update({ where: { id }, data: { state } }),
      'checkIn.setState',
    );
  }

  /** Record an employee reply: compute lead time and close the session atomically. */
  async markResponded(id: string, replyTime: Date): Promise<CheckIn | null> {
    return withRetry(
      () =>
        this.prisma.$transaction(async (tx) => {
          const current = await tx.checkIn.findUnique({ where: { id } });
          if (!current || current.status !== 'OPEN' || !current.firstMessageTime) {
            return null;
          }
          const lead = Math.max(
            0,
            Math.round((replyTime.getTime() - current.firstMessageTime.getTime()) / 1000),
          );
          return tx.checkIn.update({
            where: { id },
            data: {
              replyTime,
              leadTimeSeconds: lead,
              status: 'RESPONDED',
              state: 'RESPONDED',
            },
          });
        }),
      'checkIn.markResponded',
    );
  }

  async markMissed(id: string): Promise<void> {
    await withRetry(
      () =>
        this.prisma.checkIn.update({
          where: { id },
          data: { status: 'MISSED', state: 'MISSED' },
        }),
      'checkIn.markMissed',
    );
  }

  async addReminder(checkInId: string, level: number, message: string): Promise<Reminder | null> {
    try {
      return await this.prisma.reminder.create({ data: { checkInId, level, message } });
    } catch {
      // Unique (checkInId, level) -> reminder already sent, never duplicate.
      return null;
    }
  }

  async listReminders(checkInId: string): Promise<Reminder[]> {
    return withRetry(
      () => this.prisma.reminder.findMany({ where: { checkInId }, orderBy: { level: 'asc' } }),
      'checkIn.listReminders',
    );
  }

  async addMessage(
    checkInId: string | null,
    direction: 'BOT' | 'EMPLOYEE' | 'SYSTEM',
    message: string,
  ): Promise<void> {
    await withRetry(
      () => this.prisma.messageHistory.create({ data: { checkInId, direction, message } }),
      'checkIn.addMessage',
    );
  }

  async threadMessages(checkInId: string): Promise<MessageHistory[]> {
    return withRetry(
      () =>
        this.prisma.messageHistory.findMany({
          where: { checkInId },
          orderBy: { createdAt: 'asc' },
        }),
      'checkIn.threadMessages',
    );
  }

  /** All check-ins for a business day range, for report generation. */
  async findBetween(from: Date, to: Date): Promise<CheckIn[]> {
    return withRetry(
      () =>
        this.prisma.checkIn.findMany({
          where: { scheduledTime: { gte: from, lt: to } },
        }),
      'checkIn.findBetween',
    );
  }
}
