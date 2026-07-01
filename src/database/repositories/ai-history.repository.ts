import type { AIMessageHistory, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { withRetry } from '../client';

/** Stores generated AI content to avoid repetition and provide a fallback cache. */
export class AIHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  static hash(text: string): string {
    return createHash('sha256').update(text.trim().toLowerCase()).digest('hex').slice(0, 32);
  }

  async record(entry: {
    employeeId?: string | null;
    category: string;
    title?: string | null;
    summary: string;
    message: string;
  }): Promise<AIMessageHistory> {
    const hash = AIHistoryRepository.hash(entry.message);
    return withRetry(
      () =>
        this.prisma.aIMessageHistory.create({
          data: {
            employeeId: entry.employeeId ?? null,
            category: entry.category,
            title: entry.title ?? null,
            summary: entry.summary,
            message: entry.message,
            hash,
            used: true,
            usedAt: new Date(),
          },
        }),
      'aiHistory.record',
    );
  }

  /** Recent categories/hashes within N days, used to steer away from repeats. */
  async recent(days: number): Promise<{ categories: string[]; hashes: Set<string> }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await withRetry(
      () =>
        this.prisma.aIMessageHistory.findMany({
          where: { generatedAt: { gte: since } },
          select: { category: true, hash: true },
          orderBy: { generatedAt: 'desc' },
        }),
      'aiHistory.recent',
    );
    return {
      categories: [...new Set(rows.map((r) => r.category))],
      hashes: new Set(rows.map((r) => r.hash)),
    };
  }

  async existsRecently(message: string, days: number): Promise<boolean> {
    const hash = AIHistoryRepository.hash(message);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const row = await withRetry(
      () =>
        this.prisma.aIMessageHistory.findFirst({
          where: { hash, generatedAt: { gte: since } },
        }),
      'aiHistory.existsRecently',
    );
    return row !== null;
  }

  /**
   * Fallback cache: an old message never sent to this employee and outside the
   * recent-repeat window.
   */
  async fallbackFor(employeeId: string | null, days: number): Promise<AIMessageHistory | null> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return withRetry(
      () =>
        this.prisma.aIMessageHistory.findFirst({
          where: {
            generatedAt: { lt: since },
            NOT: { employeeId: employeeId ?? undefined },
          },
          orderBy: { generatedAt: 'asc' },
        }),
      'aiHistory.fallbackFor',
    );
  }
}
