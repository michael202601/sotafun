import { PrismaClient } from '@prisma/client';

/**
 * Admin CLI to register or update a designated employee (the person a bot
 * tracks). Upserts by email, so re-running with the same email updates the
 * record - use this to fill in googleChatUserId later.
 *
 * Usage:
 *   npm run add-employee -- --name "Kyle Ngo" --email kyle.ngo@sotatek.com \
 *     [--chatUserId 1234567890] [--timezone Asia/Seoul] \
 *     [--workStart 02:00] [--workEnd 11:00] \
 *     [--lunchStart 04:00] [--lunchEnd 05:00] [--disabled]
 */
function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true; // boolean flag, e.g. --disabled
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function str(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const email = str(args.email);
  if (!email) {
    // eslint-disable-next-line no-console
    console.error('Error: --email is required.');
    process.exit(1);
  }

  const name = str(args.name) ?? email.split('@')[0];
  // A googleChatUserId of '' would collide on the unique index; store null.
  const chatUserId = str(args.chatUserId) || null;

  const data = {
    name,
    googleChatUserId: chatUserId,
    timezone: str(args.timezone) ?? 'Asia/Seoul',
    workStart: str(args.workStart) ?? '02:00',
    workEnd: str(args.workEnd) ?? '11:00',
    lunchStart: str(args.lunchStart) ?? '04:00',
    lunchEnd: str(args.lunchEnd) ?? '05:00',
    enabled: args.disabled !== true,
  };

  const prisma = new PrismaClient();
  try {
    const employee = await prisma.employee.upsert({
      where: { email },
      update: data,
      create: { email, ...data },
    });
    // eslint-disable-next-line no-console
    console.log('Employee saved:', {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      googleChatUserId: employee.googleChatUserId,
      timezone: employee.timezone,
      enabled: employee.enabled,
    });
    if (!employee.googleChatUserId) {
      // eslint-disable-next-line no-console
      console.warn(
        'Note: googleChatUserId is empty. Reply tracking needs it. Re-run with ' +
          `--email ${email} --chatUserId <users-id> once the person is in the space.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
