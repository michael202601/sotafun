import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  DATABASE_URL: z.string().min(1),

  GOOGLE_SERVICE_ACCOUNT_FILE: z.string().min(1),
  GOOGLE_CHAT_EMPLOYEE_SPACE: z.string().min(1),
  GOOGLE_CHAT_MANAGER_SPACE: z.string().min(1),
  GOOGLE_CHAT_VERIFICATION_TOKEN: z.string().min(1),
  // Google Cloud project number. When set, inbound webhooks are verified via the
  // Google-issued JWT (production). When empty, the static token above is used.
  GOOGLE_CHAT_AUDIENCE: z.string().optional(),

  CLAUDE_CODE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  CLAUDE_CODE_BIN: z.string().default('claude'),
  CLAUDE_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),

  TIMEZONE: z.string().default('Asia/Seoul'),
  US_TIMEZONE: z.string().default('America/New_York'),

  WORK_START: hhmm.default('02:00'),
  WORK_END: hhmm.default('11:00'),
  LUNCH_START: hhmm.default('04:00'),
  LUNCH_END: hhmm.default('05:00'),

  CHECK_INTERVAL: z.coerce.number().int().positive().default(30),
  FIRST_REMINDER: z.coerce.number().int().positive().default(5),
  SECOND_REMINDER: z.coerce.number().int().positive().default(5),
  THIRD_REMINDER: z.coerce.number().int().positive().default(5),

  REPORT_TIME: hhmm.default('11:05'),

  AI_HISTORY_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parse and validate process.env once. Throws with a readable message on
 * misconfiguration so the container fails fast at startup.
 */
export function loadConfig(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
