import type { Request, Response } from 'express';
import type { AppContext } from './context';

/**
 * GET /health — reports the status of each subsystem. Docker uses this to
 * decide container health. Never throws; degraded checks return "error".
 */
export function createHealthHandler(ctx: AppContext) {
  return async (_req: Request, res: Response): Promise<void> => {
    const [database, claude, googleChat] = await Promise.all([
      check(() => ctx.prisma.$queryRaw`SELECT 1`),
      check(() => ctx.ai.isAvailable()),
      check(() => ctx.chat.isAvailable()),
    ]);

    const scheduler = 'ok';
    const allOk = [database, claude, googleChat].every((s) => s === 'ok');
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      database,
      claude,
      googleChat,
      scheduler,
    });
  };
}

async function check(fn: () => Promise<unknown>): Promise<'ok' | 'error'> {
  try {
    const result = await fn();
    if (typeof result === 'boolean') return result ? 'ok' : 'error';
    return 'ok';
  } catch {
    return 'error';
  }
}
