import type { PrismaClient } from '@prisma/client';
import { withRetry } from '../client';

/** Global key/value settings stored in the DB. */
export class SettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string): Promise<string | null> {
    const row = await withRetry(
      () => this.prisma.settings.findUnique({ where: { key } }),
      'settings.get',
    );
    return row?.value ?? null;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const value = await this.get(key);
    if (value === null) return fallback;
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  async set(key: string, value: string): Promise<void> {
    await withRetry(
      () =>
        this.prisma.settings.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      'settings.set',
    );
  }

  async all(): Promise<Record<string, string>> {
    const rows = await withRetry(() => this.prisma.settings.findMany(), 'settings.all');
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async isEmpty(): Promise<boolean> {
    const count = await withRetry(() => this.prisma.settings.count(), 'settings.count');
    return count === 0;
  }
}
