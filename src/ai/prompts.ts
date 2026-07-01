import type { GenerationContext } from './types';

const PERSONA = `You are a friendly, funny, curious AI coworker in a team Google Chat.
You are NOT an attendance system or a monitoring tool. You sound like a real teammate.
Rules:
- Keep the message under 80 words. Short, warm, easy to answer, fun.
- Use at most a couple of emojis, naturally.
- Never touch: politics, religion, violence, sexual content, medical/financial advice,
  personal criticism, offensive or dark humor.
- Output ONLY the chat message text. No preamble, no quotes, no markdown headers.`;

const CATEGORIES = [
  'programming-joke',
  'dad-joke',
  'tech-news',
  'ai-trivia',
  'space-fact',
  'animal-fact',
  'coffee-fact',
  'korean-culture',
  'us-culture',
  'random-fact',
  'mini-quiz',
  'guess-the-answer',
  'emoji-challenge',
  'brain-teaser',
  'one-minute-puzzle',
  'motivational-quote',
  'positive-message',
  'health-reminder',
  'stretch-reminder',
  'eye-exercise-reminder',
];

function avoidClause(recent: string[]): string {
  if (!recent.length) return '';
  return `\nRecently used topics to AVOID repeating: ${recent.join(', ')}.`;
}

/** Map a language code to a full name for the prompt. Defaults to Vietnamese. */
function languageName(code: string | undefined): string {
  switch (code) {
    case 'en':
      return 'English';
    case 'ko':
      return 'Korean';
    case 'vi':
    default:
      return 'Vietnamese';
  }
}

/** Prompt for a fresh check-in message. Returns the picked category too. */
export function checkInPrompt(ctx: GenerationContext): { prompt: string; category: string } {
  const pool = CATEGORIES.filter((c) => !ctx.recentCategories.includes(c));
  const choices = pool.length ? pool : CATEGORIES;
  // Deterministic-but-varied pick based on recent history length.
  const category = choices[ctx.recentCategories.length % choices.length];
  const lang = languageName(ctx.language);
  const prompt = `${PERSONA}

Write a single fresh check-in message in ${lang}.
Topic category: "${category}".
Make it original and engaging, and invite a quick reply (a guess, an emoji, or a short answer).${avoidClause(
    ctx.recentCategories,
  )}`;
  return { prompt, category };
}

/** Prompt for a reminder at a given escalation level (1 friendly, 2 funny, 3 playful). */
export function reminderPrompt(level: 1 | 2 | 3, ctx: GenerationContext): string {
  const tone = level === 1 ? 'friendly and gentle' : level === 2 ? 'funny and light' : 'playful';
  const lang = languageName(ctx.language);
  return `${PERSONA}

The teammate has not replied yet. Write ONE short ${tone} nudge in ${lang} to gently get their
attention. Never sound aggressive, never sound like an attendance check. Under 30 words.`;
}

/** Prompt for a short natural follow-up after an employee replies. */
export function followUpPrompt(ctx: GenerationContext): string {
  const lang = languageName(ctx.language);
  const convo = (ctx.conversation ?? [])
    .map((m) => `${m.role === 'BOT' ? 'You' : 'Teammate'}: ${m.text}`)
    .join('\n');
  return `${PERSONA}

Here is the current short conversation:
${convo}

Reply with ONE short, warm follow-up (1-2 sentences max) in ${lang}. Do not start a long
conversation. If a reply is unnecessary, still keep it tiny and friendly.`;
}

/** Prompt for a manager-facing daily summary. */
export function dailySummaryPrompt(stats: string): string {
  return `You are writing a short, positive daily wellness summary for a manager report.
Base it ONLY on these statistics:
${stats}

Write 1-2 upbeat, constructive sentences IN VIETNAMESE. Never criticize employees.
Output only the summary text.`;
}

export { CATEGORIES };
