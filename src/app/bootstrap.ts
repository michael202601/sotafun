import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppContext } from './context';
import { getLogger } from '../utils/logger';

const execFileAsync = promisify(execFile);
const logger = getLogger('scheduler');

const DEFAULT_SETTINGS: Record<string, string> = {
  CHECK_INTERVAL: '30',
  FIRST_TIMEOUT: '300',
  SECOND_TIMEOUT: '300',
  THIRD_TIMEOUT: '300',
  AI_HISTORY_DAYS: '30',
  REPORT_TIME: '11:05',
};

/** Run Prisma migrations, seed defaults, and log recovery state at startup. */
export async function bootstrap(ctx: AppContext): Promise<void> {
  await runMigrations();
  await seedSettings(ctx);
  await logRecovery(ctx);
}

async function runMigrations(): Promise<void> {
  try {
    await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], {
      env: process.env,
    });
    logger.info('Prisma migrations applied');
  } catch (err) {
    // `db push` fallback for environments without a migration history.
    logger.warn('migrate deploy failed, falling back to db push', {
      error: (err as Error).message,
    });
    await execFileAsync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
      env: process.env,
    });
  }
}

async function seedSettings(ctx: AppContext): Promise<void> {
  if (!(await ctx.settings.isEmpty())) return;
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await ctx.settings.set(key, value);
  }
  logger.info('Seeded default settings');
}

async function logRecovery(ctx: AppContext): Promise<void> {
  // Reminder/timeout state is derived from the DB every tick, so unfinished
  // sessions resume automatically. We only report how many are in flight.
  const active = await ctx.checkIns.findActive();
  logger.info('Recovery complete', { activeCheckIns: active.length });
}
