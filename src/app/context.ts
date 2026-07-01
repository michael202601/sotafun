import type { PrismaClient } from '@prisma/client';
import { loadConfig, type Env } from '../config/env';
import { getPrisma } from '../database/client';
import { SettingsRepository } from '../database/repositories/settings.repository';
import { EmployeeRepository } from '../database/repositories/employee.repository';
import { CheckInRepository } from '../database/repositories/checkin.repository';
import { AIHistoryRepository } from '../database/repositories/ai-history.repository';
import { ReportRepository } from '../database/repositories/report.repository';
import { ClaudeCodeProvider } from '../ai/claude-provider';
import { AIService } from '../ai/ai.service';
import { GoogleChatService } from '../google-chat/chat.service';
import { TimeService } from '../utils/time';

/**
 * Composition root. Instantiates and wires every service once, then hands the
 * bundle to the server, scheduler and routers (manual dependency injection).
 */
export class AppContext {
  readonly env: Env;
  readonly prisma: PrismaClient;
  readonly time: TimeService;

  readonly settings: SettingsRepository;
  readonly employees: EmployeeRepository;
  readonly checkIns: CheckInRepository;
  readonly aiHistory: AIHistoryRepository;
  readonly reports: ReportRepository;

  readonly ai: AIService;
  readonly chat: GoogleChatService;

  constructor() {
    this.env = loadConfig();
    this.prisma = getPrisma();
    this.time = new TimeService(this.env);

    this.settings = new SettingsRepository(this.prisma);
    this.employees = new EmployeeRepository(this.prisma);
    this.checkIns = new CheckInRepository(this.prisma);
    this.aiHistory = new AIHistoryRepository(this.prisma);
    this.reports = new ReportRepository(this.prisma);

    const provider = new ClaudeCodeProvider(this.env);
    this.ai = new AIService(
      provider,
      this.aiHistory,
      this.env.AI_HISTORY_DAYS,
      this.env.BOT_LANGUAGE,
    );
    this.chat = new GoogleChatService(this.env);
  }
}
