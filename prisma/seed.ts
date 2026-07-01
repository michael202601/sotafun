import { PrismaClient } from '@prisma/client';

/**
 * Seed default global settings if the database is empty.
 * Idempotent: existing keys are left untouched.
 */
const DEFAULT_SETTINGS: Record<string, string> = {
  CHECK_INTERVAL: '30',
  FIRST_TIMEOUT: '300',
  SECOND_TIMEOUT: '300',
  THIRD_TIMEOUT: '300',
  AI_HISTORY_DAYS: '30',
  REPORT_TIME: '11:05',
};

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await prisma.settings.upsert({
        where: { key },
        update: {},
        create: { key, value },
      });
    }
    // eslint-disable-next-line no-console
    console.log('Default settings seeded.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
