import { getLogger } from '../utils/logger';
import type { AIProvider, GeneratedContent, GenerationContext } from './types';
import type { AIHistoryRepository } from '../database/repositories/ai-history.repository';
import {
  checkInPrompt,
  dailySummaryPrompt,
  followUpPrompt,
  reminderPrompt,
} from './prompts';

const logger = getLogger('claude');

/** Minimal static fallbacks - used only when Claude AND the cache are unavailable. */
const STATIC_CHECKINS = [
  '👋 Quick hello! What is one word to describe your day so far? 😄',
  '☕ Coffee level check — how are you doing right now?',
  '🧠 Tiny brain break: reply with an emoji that matches your mood!',
];
const STATIC_REMINDERS: Record<number, string> = {
  1: '👀 Still there? No rush 😄',
  2: 'I think your keyboard dozed off — wake it up 😂',
  3: 'Last friendly poke before I move on 😆',
};

/**
 * Orchestrates all AI interactions. Depends only on the AIProvider interface,
 * so the LLM can be swapped later. Handles retry, de-duplication and fallback.
 */
export class AIService {
  constructor(
    private readonly provider: AIProvider,
    private readonly history: AIHistoryRepository,
    private readonly historyDays: number,
    private readonly retries = 2,
  ) {}

  isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  private async tryGenerate(prompt: string): Promise<string | null> {
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const text = await this.provider.generate(prompt);
        if (text) return text;
      } catch (err) {
        logger.warn(`AI generate failed (attempt ${attempt}/${this.retries})`, {
          error: (err as Error).message,
        });
      }
    }
    return null;
  }

  /** Generate a fresh check-in message, avoiding recent topics. */
  async generateCheckIn(employeeId?: string, language?: string): Promise<GeneratedContent> {
    const recent = await this.history.recent(this.historyDays);
    const ctx: GenerationContext = { recentCategories: recent.categories, language };
    const { prompt, category } = checkInPrompt(ctx);

    const text = await this.tryGenerate(prompt);
    if (text && !(await this.history.existsRecently(text, this.historyDays))) {
      await this.history.record({ employeeId, category, summary: category, message: text });
      return { message: text, category };
    }

    // Fallback: reuse an old cached message not sent to this employee.
    const cached = await this.history.fallbackFor(employeeId ?? null, this.historyDays);
    if (cached) {
      logger.info('Using cached AI content as fallback');
      return { message: cached.message, category: cached.category };
    }

    // Final fallback: minimal static content.
    logger.warn('Using static fallback check-in');
    const idx = recent.categories.length % STATIC_CHECKINS.length;
    return { message: STATIC_CHECKINS[idx], category: 'static' };
  }

  /** Generate a reminder message at an escalation level. */
  async generateReminder(level: 1 | 2 | 3, language?: string): Promise<string> {
    const prompt = reminderPrompt(level, { recentCategories: [], language });
    const text = await this.tryGenerate(prompt);
    return text ?? STATIC_REMINDERS[level];
  }

  /** Generate a short follow-up reply given the thread so far. */
  async generateFollowUp(
    conversation: GenerationContext['conversation'],
    language?: string,
  ): Promise<string | null> {
    const prompt = followUpPrompt({ recentCategories: [], language, conversation });
    return this.tryGenerate(prompt);
  }

  /** Generate a positive daily summary for the manager report. */
  async generateDailySummary(statsText: string): Promise<string | null> {
    return this.tryGenerate(dailySummaryPrompt(statsText));
  }
}
