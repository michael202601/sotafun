import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'node:fs';

const LOG_DIR = process.env.LOG_DIR ?? '/logs';

// Ensure the log directory exists (best-effort; falls back silently).
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
  /* ignore - console transport still works */
}

const level = process.env.LOG_LEVEL ?? 'info';

const baseFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level: lvl, message, module, ...rest }) => {
    const mod = module ? `[${module}] ` : '';
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    return `${timestamp} ${lvl.toUpperCase()} ${mod}${message}${extra}`;
  }),
);

function rotateTransport(filename: string): DailyRotateFile {
  return new DailyRotateFile({
    dirname: LOG_DIR,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    zippedArchive: true,
  });
}

const rootLogger = createLogger({
  level,
  format: baseFormat,
  transports: [
    new transports.Console(),
    rotateTransport('application'),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      level: 'error',
      zippedArchive: true,
    }),
  ],
});

// Per-module log files so each subsystem has its own stream, per docs.
const moduleFiles: Record<string, string> = {
  scheduler: 'scheduler',
  'google-chat': 'google-chat',
  claude: 'claude',
  report: 'report',
};

const moduleLoggers = new Map<string, Logger>();

/**
 * Return a child logger tagged with a module name. Known modules also get a
 * dedicated rotating file; everything still flows to application.log.
 */
export function getLogger(module: string): Logger {
  const existing = moduleLoggers.get(module);
  if (existing) return existing;

  const child = rootLogger.child({ module });
  const file = moduleFiles[module];
  if (file) {
    child.add(rotateTransport(file));
  }
  moduleLoggers.set(module, child);
  return child;
}

export { LOG_DIR };
