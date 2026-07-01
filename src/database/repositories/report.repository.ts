import type { DailyReport, PrismaClient } from '@prisma/client';
import { withRetry } from '../client';

export interface DailyReportInput {
  date: string;
  employeeId: string;
  totalCheckIns: number;
  responses: number;
  misses: number;
  averageLeadTime: number;
  longestLeadTime: number;
  fastestLeadTime: number;
  responseRate: number;
  aiSummary?: string | null;
}

/** Access to persisted daily reports (never deleted, per docs). */
export class ReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertDaily(input: DailyReportInput): Promise<DailyReport> {
    const { date, employeeId, ...rest } = input;
    return withRetry(
      () =>
        this.prisma.dailyReport.upsert({
          where: { date_employeeId: { date, employeeId } },
          update: { ...rest, generatedAt: new Date() },
          create: { date, employeeId, ...rest },
        }),
      'report.upsertDaily',
    );
  }

  async findByDate(date: string): Promise<DailyReport[]> {
    return withRetry(
      () => this.prisma.dailyReport.findMany({ where: { date } }),
      'report.findByDate',
    );
  }

  async findRange(fromDate: string, toDate: string): Promise<DailyReport[]> {
    return withRetry(
      () =>
        this.prisma.dailyReport.findMany({
          where: { date: { gte: fromDate, lte: toDate } },
          orderBy: { date: 'asc' },
        }),
      'report.findRange',
    );
  }
}
