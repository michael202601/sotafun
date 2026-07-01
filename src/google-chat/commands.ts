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
      return '🏓 pong — mình đang online!';

    case 'help':
      return [
        'Mình có thể giúp bạn 😄',
        '/ping — kiểm tra mình có online không',
        '/status — trạng thái check-in hiện tại của bạn',
        '/report — thống kê hôm nay của bạn',
        '/skip — bỏ qua lần check-in tới (sắp có)',
      ].join('\n');

    case 'status':
      return statusFor(ctx, employee);

    case 'report':
      // Manager report variants (today/week/month/...) are handled in phase 2.
      if (arg) return `Báo cáo "${arg}" sắp ra mắt 😄`;
      return personalReport(ctx, employee);

    default:
      return `Không rõ lệnh "/${command}". Thử /help nhé 😄`;
  }
}

async function statusFor(ctx: AppContext, employee: Employee | null): Promise<string> {
  if (!employee) return 'Mình chưa khớp bạn với hồ sơ nhân viên nào.';
  const open = await ctx.checkIns.findOpenForEmployee(employee.id);
  if (!open) return 'Hiện không có check-in nào đang mở. Tập trung làm việc nhé 😄';
  return `Bạn đang có một check-in mở từ ${open.scheduledTime.toISOString()}. Trả lời bất cứ lúc nào nhé!`;
}

async function personalReport(ctx: AppContext, employee: Employee | null): Promise<string> {
  if (!employee) return 'Mình chưa khớp bạn với hồ sơ nhân viên nào.';
  const day = ctx.time.businessDay();
  const reports = await ctx.reports.findByDate(day);
  const mine = reports.find((r) => r.employeeId === employee.id);
  if (!mine) return 'Hôm nay chưa có thống kê — ngày còn dài mà 😄';
  return [
    `📊 Thống kê của bạn ngày ${day}`,
    `Số lần Lisa hỏi thăm: ${mine.totalCheckIns}`,
    `Số lần phản hồi: ${mine.responses}`,
    `Tỉ lệ phản hồi: ${mine.responseRate.toFixed(1)}%`,
    `Thời gian phản hồi trung bình: ${TimeService.formatLeadTime(mine.averageLeadTime)}`,
    'Cố lên nhé! 🎉',
  ].join('\n');
}
