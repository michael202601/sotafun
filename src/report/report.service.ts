import type { AppContext } from '../app/context';
import type { CheckIn, Employee } from '@prisma/client';
import { getLogger } from '../utils/logger';
import { TimeService } from '../utils/time';
import { DateTime } from 'luxon';

const logger = getLogger('report');

interface EmployeeStats {
  total: number;
  responses: number;
  misses: number;
  leadTimes: number[];
}

/**
 * Aggregates a business day's check-ins into per-employee statistics, persists
 * a DailyReport, asks the AI for a positive summary, and posts to the manager
 * space. Report generation never blocks the scheduler and is safe to re-run.
 */
export class ReportService {
  constructor(private readonly ctx: AppContext) {}

  /** Generate and post the daily report for the current business day. */
  async generateDaily(now: Date = new Date()): Promise<void> {
    const day = this.ctx.time.businessDay(now);
    const { from, to } = this.businessDayRange(day);

    const checkIns = await this.ctx.checkIns.findBetween(from, to);
    const employees = await this.ctx.employees.listEnabled();
    const byEmployee = this.groupStats(checkIns);

    for (const employee of employees) {
      const stats = byEmployee.get(employee.id) ?? {
        total: 0,
        responses: 0,
        misses: 0,
        leadTimes: [],
      };
      await this.reportForEmployee(day, employee, stats);
    }
    logger.info('Daily report generated', { day, employees: employees.length });
  }

  private async reportForEmployee(
    day: string,
    employee: Employee,
    stats: EmployeeStats,
  ): Promise<void> {
    const responseRate = stats.total > 0 ? (stats.responses / stats.total) * 100 : 0;
    const avg = stats.leadTimes.length
      ? Math.round(stats.leadTimes.reduce((a, b) => a + b, 0) / stats.leadTimes.length)
      : 0;
    const longest = stats.leadTimes.length ? Math.max(...stats.leadTimes) : 0;
    const fastest = stats.leadTimes.length ? Math.min(...stats.leadTimes) : 0;

    const statsText = [
      `Employee: ${employee.name}`,
      `Check-ins: ${stats.total}`,
      `Responses: ${stats.responses}`,
      `Missed: ${stats.misses}`,
      `Response rate: ${responseRate.toFixed(1)}%`,
      `Average response: ${TimeService.formatLeadTime(avg)}`,
    ].join('\n');

    const aiSummary = await this.safeSummary(statsText);

    await this.ctx.reports.upsertDaily({
      date: day,
      employeeId: employee.id,
      totalCheckIns: stats.total,
      responses: stats.responses,
      misses: stats.misses,
      averageLeadTime: avg,
      longestLeadTime: longest,
      fastestLeadTime: fastest,
      responseRate,
      aiSummary,
    });

    const card = this.formatDaily(day, employee.name, {
      total: stats.total,
      responses: stats.responses,
      misses: stats.misses,
      responseRate,
      avg,
      longest,
      fastest,
      aiSummary,
    });

    try {
      await this.ctx.chat.sendToManagers(card);
    } catch (err) {
      logger.error('Failed to post daily report', {
        employee: employee.name,
        error: (err as Error).message,
      });
    }
  }

  private async safeSummary(statsText: string): Promise<string | null> {
    try {
      return await this.ctx.ai.generateDailySummary(statsText);
    } catch {
      return null;
    }
  }

  private groupStats(checkIns: CheckIn[]): Map<string, EmployeeStats> {
    const map = new Map<string, EmployeeStats>();
    for (const c of checkIns) {
      const s =
        map.get(c.employeeId) ?? { total: 0, responses: 0, misses: 0, leadTimes: [] };
      s.total += 1;
      if (c.status === 'RESPONDED') {
        s.responses += 1;
        if (typeof c.leadTimeSeconds === 'number') s.leadTimes.push(c.leadTimeSeconds);
      } else if (c.status === 'MISSED') {
        s.misses += 1;
      }
      map.set(c.employeeId, s);
    }
    return map;
  }

  private businessDayRange(day: string): { from: Date; to: Date } {
    const start = DateTime.fromFormat(day, 'yyyy-MM-dd', { zone: this.ctx.env.TIMEZONE }).startOf(
      'day',
    );
    return { from: start.toJSDate(), to: start.plus({ days: 1 }).toJSDate() };
  }

  private formatDaily(
    day: string,
    name: string,
    d: {
      total: number;
      responses: number;
      misses: number;
      responseRate: number;
      avg: number;
      longest: number;
      fastest: number;
      aiSummary: string | null;
    },
  ): string {
    const lines = [
      '📊 Daily Wellness Report',
      `Date: ${day}`,
      `Employee: ${name}`,
      `Check-ins: ${d.total}`,
      `Responses: ${d.responses}`,
      `Missed: ${d.misses}`,
      `Response Rate: ${d.responseRate.toFixed(1)}%`,
      `Average Response: ${TimeService.formatLeadTime(d.avg)}`,
      `Fastest: ${TimeService.formatLeadTime(d.fastest)}`,
      `Slowest: ${TimeService.formatLeadTime(d.longest)}`,
    ];
    if (d.aiSummary) {
      lines.push('', `AI Summary: ${d.aiSummary}`);
    }
    return lines.join('\n');
  }
}
