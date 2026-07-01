import type { AppContext } from '../app/context';
import type { Employee } from '@prisma/client';
import { TimeService } from '../utils/time';

/**
 * Handle a slash command. Returns the text to reply with, or null if the input
 * is not a recognized command.
 */
export async function handleCommand(
  ctx: AppContext,
  text: string,
  employee: Employee | null,
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;

  const [command, ...rest] = trimmed.slice(1).split(/\s+/);
  const arg = rest.join(' ');

  switch (command.toLowerCase()) {
    case 'ping':
      return '🏓 pong — I am online!';

    case 'help':
      return [
        'Here is what I can do 😄',
        '/ping — check I am online',
        '/status — your current check-in status',
        '/report — your stats for today',
        '/skip — skip your next check-in (coming soon)',
      ].join('\n');

    case 'status':
      return statusFor(ctx, employee);

    case 'report':
      // Manager report variants (today/week/month/...) are handled in phase 2.
      if (arg) return `Report "${arg}" is coming soon 😄`;
      return personalReport(ctx, employee);

    default:
      return `Unknown command "/${command}". Try /help 😄`;
  }
}

async function statusFor(ctx: AppContext, employee: Employee | null): Promise<string> {
  if (!employee) return 'I could not match you to an employee record.';
  const open = await ctx.checkIns.findOpenForEmployee(employee.id);
  if (!open) return 'No active check-in right now. Enjoy the focus time 😄';
  return `You have an open check-in from ${open.scheduledTime.toISOString()}. Reply any time!`;
}

async function personalReport(ctx: AppContext, employee: Employee | null): Promise<string> {
  if (!employee) return 'I could not match you to an employee record.';
  const day = ctx.time.businessDay();
  const reports = await ctx.reports.findByDate(day);
  const mine = reports.find((r) => r.employeeId === employee.id);
  if (!mine) return 'No stats yet for today — the day is still young 😄';
  return [
    `📊 Your stats for ${day}`,
    `Check-ins: ${mine.totalCheckIns}`,
    `Responses: ${mine.responses}`,
    `Response rate: ${mine.responseRate.toFixed(1)}%`,
    `Average response: ${TimeService.formatLeadTime(mine.averageLeadTime)}`,
    'Keep it up! 🎉',
  ].join('\n');
}
