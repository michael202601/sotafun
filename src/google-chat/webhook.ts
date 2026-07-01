import type { Request, Response } from 'express';
import type { AppContext } from '../app/context';
import { getLogger } from '../utils/logger';
import { handleCommand } from './commands';
import { verifyChatJwt } from './auth';

const logger = getLogger('google-chat');

/**
 * Authenticate an inbound request. In production (GOOGLE_CHAT_AUDIENCE set) the
 * Google-issued Bearer JWT is verified. Otherwise a static shared token is
 * accepted (Authorization: Bearer <token> or ?token=<token>) for local testing.
 */
async function isAuthentic(ctx: AppContext, req: Request): Promise<boolean> {
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (ctx.env.GOOGLE_CHAT_AUDIENCE) {
    if (!bearer) return false;
    return verifyChatJwt(bearer, ctx.env.GOOGLE_CHAT_AUDIENCE);
  }
  // Static mode: accept when the shared token matches EITHER the query string or
  // the Authorization header. Google Chat always sends its own Bearer JWT in the
  // header, so we must not let that override a valid ?token= match.
  const expected = ctx.env.GOOGLE_CHAT_VERIFICATION_TOKEN;
  const qToken = req.query.token as string | undefined;
  return qToken === expected || bearer === expected;
}

/** Max time to wait for an AI reply to a direct mention before falling back. */
const MENTION_AI_TIMEOUT_MS = 12000;

/** Resolve `null` if the promise does not settle within `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Bounded set of processed event/message ids for idempotency. */
const processed = new Set<string>();
const PROCESSED_MAX = 5000;

function remember(id: string): boolean {
  if (processed.has(id)) return false;
  processed.add(id);
  if (processed.size > PROCESSED_MAX) {
    // Drop the oldest ~10% (insertion order preserved by Set).
    const drop = Math.floor(PROCESSED_MAX * 0.1);
    let i = 0;
    for (const k of processed) {
      processed.delete(k);
      if (++i >= drop) break;
    }
  }
  return true;
}

/**
 * Express handler for inbound Google Chat events. Validates the request,
 * dedupes events, and routes MESSAGE events to commands or reply handling.
 * Always responds 200 quickly; never crashes the app on a bad event.
 */
export function createWebhookHandler(ctx: AppContext) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      if (!(await isAuthentic(ctx, req))) {
        logger.warn('Rejected webhook with invalid credentials');
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const event = (req.body ?? {}) as Record<string, unknown>;
      const norm = normalizeEvent(event);

      if (!norm.isMessage) {
        res.status(200).json(emptyReply(norm.kind));
        return;
      }
      if (norm.messageName && !remember(norm.messageName)) {
        // Duplicate delivery — ignore, but acknowledge.
        res.status(200).json(emptyReply(norm.kind));
        return;
      }

      const reply = await handleMessage(ctx, norm);
      res.status(200).json(formatReply(norm.kind, reply));
    } catch (err) {
      logger.error('Webhook processing error', { error: (err as Error).message });
      // Never surface internal errors to Google Chat.
      res.status(200).json({});
    }
  };
}

type EventKind = 'addon' | 'classic';

/** A Google Chat event normalized across the classic and add-on payload shapes. */
interface NormalizedEvent {
  kind: EventKind;
  isMessage: boolean;
  /** Command/answer text with any @mention stripped. */
  text: string;
  /** Sender id without the "users/" prefix. */
  senderUserId: string;
  /** True if the sender is a human (not another app/bot). */
  isHuman: boolean;
  /** True if the message is in a 1:1 direct message space. */
  isDm: boolean;
  /** Thread resource name, if any. */
  threadName: string;
  /** Message resource name, for dedupe. */
  messageName: string;
}

function spaceIsDm(space: Record<string, unknown>): boolean {
  return asStr(space.type) === 'DM' || asStr(space.spaceType) === 'DIRECT_MESSAGE';
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function stripUser(name: string): string {
  return name.startsWith('users/') ? name.slice('users/'.length) : name;
}

/**
 * Normalize both event formats:
 *  - Google Workspace add-on (gsuiteaddons): { chat: { user, messagePayload: { message, space } } }
 *  - Classic Chat app (App URL):             { type: 'MESSAGE', message: { sender, ... } }
 */
function normalizeEvent(event: Record<string, unknown>): NormalizedEvent {
  const chat = event.chat as Record<string, unknown> | undefined;
  if (chat) {
    const payload = chat.messagePayload as Record<string, unknown> | undefined;
    const message = (payload?.message ?? {}) as Record<string, unknown>;
    const user = (chat.user ?? {}) as Record<string, unknown>;
    const space = (payload?.space ?? {}) as Record<string, unknown>;
    const thread = (message.thread ?? {}) as Record<string, unknown>;
    const messageSender = (message.sender ?? {}) as Record<string, unknown>;
    const text = (asStr(message.argumentText) || asStr(message.text)).trim();
    return {
      kind: 'addon',
      isMessage: !!payload?.message,
      text,
      senderUserId: stripUser(asStr(user.name) || asStr(messageSender.name)),
      isHuman: asStr(user.type) === 'HUMAN' || asStr(user.type) === '',
      isDm: spaceIsDm(space),
      threadName: asStr(thread.name),
      messageName: asStr(message.name),
    };
  }

  const message = (event.message ?? {}) as Record<string, unknown>;
  const sender = (message.sender ?? {}) as Record<string, unknown>;
  const space = (event.space ?? {}) as Record<string, unknown>;
  const thread = (message.thread ?? {}) as Record<string, unknown>;
  const text = (asStr(message.argumentText) || asStr(message.text)).trim();
  return {
    kind: 'classic',
    isMessage: event.type === 'MESSAGE' && !!event.message,
    text,
    senderUserId: stripUser(asStr(sender.name)),
    isHuman: asStr(sender.type) === 'HUMAN' || asStr(sender.type) === '',
    isDm: spaceIsDm(space),
    threadName: asStr(thread.name),
    messageName: asStr(message.name),
  };
}

/** Build the HTTP response body appropriate for the event format. */
function formatReply(kind: EventKind, reply: string | null): Record<string, unknown> {
  if (!reply) return emptyReply(kind);
  if (kind === 'addon') {
    return {
      hostAppDataAction: {
        chatDataAction: { createMessageAction: { message: { text: reply } } },
      },
    };
  }
  return { text: reply };
}

function emptyReply(_kind: EventKind): Record<string, unknown> {
  return {};
}

/** Best-effort short AI reply, capped so Google Chat never times out. */
async function aiReply(ctx: AppContext, text: string): Promise<string | null> {
  if (!text) return null;
  return withTimeout(
    ctx.ai.generateFollowUp([{ role: 'EMPLOYEE', text }]),
    MENTION_AI_TIMEOUT_MS,
  );
}

/** Mark a check-in responded and return a short natural acknowledgment. */
async function completeCheckIn(
  ctx: AppContext,
  checkInId: string,
  employeeName: string,
  text: string,
): Promise<string> {
  const updated = await ctx.checkIns.markResponded(checkInId, new Date());
  if (updated) {
    await ctx.checkIns.addMessage(checkInId, 'EMPLOYEE', text);
    logger.info('Employee replied', {
      employee: employeeName,
      leadTimeSeconds: updated.leadTimeSeconds,
    });
  }
  return (await aiReply(ctx, text)) ?? 'Cảm ơn bạn đã phản hồi nha 😄';
}

/** Process a normalized MESSAGE event; returns an optional synchronous reply. */
async function handleMessage(ctx: AppContext, ev: NormalizedEvent): Promise<string | null> {
  const { text, senderUserId, threadName, isDm, isHuman } = ev;

  // Safety: never respond to other apps/bots (or to ourselves) — prevents loops.
  if (!isHuman) return null;

  const employee = senderUserId ? await ctx.employees.findByChatUserId(senderUserId) : null;

  // Slash commands take priority.
  const commandReply = await handleCommand(ctx, text, employee);
  if (commandReply !== null) {
    logger.info('Handled command', { command: text.split(/\s+/)[0] });
    return commandReply;
  }

  // Direct message: the employee just replies naturally — no @mention, no thread.
  if (isDm) {
    if (employee) {
      const open = await ctx.checkIns.findOpenForEmployee(employee.id);
      if (open) return completeCheckIn(ctx, open.id, employee.name, text);
    }
    logger.info('DM chat -> AI reply', { senderUserId });
    return (await aiReply(ctx, text)) ?? '👋 Chào bạn! Mình đây 😄';
  }

  // In a space, a reply counts only inside the bot's check-in thread (legacy).
  const open = threadName ? await ctx.checkIns.findOpenByThread(threadName) : null;
  if (!open) {
    // Direct @mention in a space -> natural AI reply.
    logger.info('Mention -> AI reply', { senderUserId });
    return (await aiReply(ctx, text)) ?? '👋 Chào bạn! Mình đây. Thử /ping hoặc /help nhé 😄';
  }
  if (!employee || open.employeeId !== employee.id) {
    await ctx.checkIns.addMessage(open.id, 'SYSTEM', `Ignored reply from users/${senderUserId}`);
    logger.info('Ignored non-designated reply in thread', { threadName, senderUserId });
    return null;
  }
  return completeCheckIn(ctx, open.id, employee.name, text);
}
