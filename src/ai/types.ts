/** Result of an AI content generation. */
export interface GeneratedContent {
  /** The message to send to the employee. */
  message: string;
  /** A short category label (e.g. "programming-joke", "space-fact"). */
  category: string;
  /** Optional short title/summary for history de-duplication. */
  title?: string;
  summary?: string;
}

/** Context passed to the provider so it can avoid repetition and stay relevant. */
export interface GenerationContext {
  /** Categories used recently, to steer away from repeats. */
  recentCategories: string[];
  /** Preferred language ("en" | "ko"). */
  language?: string;
  /** Optional prior conversation (thread) for follow-ups. */
  conversation?: { role: 'BOT' | 'EMPLOYEE'; text: string }[];
}

/**
 * Provider-agnostic AI interface. Business logic depends only on this, so the
 * underlying LLM (Claude Code today) can be swapped without touching callers.
 */
export interface AIProvider {
  readonly name: string;
  /** True if the provider is currently usable (for health checks). */
  isAvailable(): Promise<boolean>;
  /** Generate a single piece of content from a fully-built prompt. */
  generate(prompt: string): Promise<string>;
}
