import { PrismaClient } from '@prisma/client';
import { getLogger } from '../utils/logger';

const logger = getLogger('database');

let prisma: PrismaClient | null = null;

/** Return the singleton Prisma client. */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/**
 * Retry a Prisma operation a few times on transient failures.
 * Every retry is logged (docs Retry Policy).
 */
export async function withRetry<T>(
  op: () => Promise<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      logger.warn(`DB op "${label}" failed (attempt ${i}/${attempts})`, {
        error: (err as Error).message,
      });
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 200 * i));
      }
    }
  }
  throw lastErr;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
