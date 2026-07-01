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
      // Log every inbound hit (before auth) to diagnose delivery/auth issues.
      logger.info('Inbound webhook', {
        type: req.body?.type,
        hasQueryToken: !!req.query.token,
        hasBearer: !!req.get('authorization'),
        bodyKeys: req.body ? Object.keys(req.body) : [],
        rawBody: JSON.stringify(req.body ?? {}).slice(0, 1500),
      });

      if (!(await isAuthentic(ctx, req))) {
        logger.warn('Rejected webhook with invalid credentials');
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const event = req.body ?? {};
      if (event.type !== 'MESSAGE' || !event.message) {
        res.status(200).json({});
        return;
      }

      const messageName: string = event.message.name ?? '';
      if (messageName && !remember(messageName)) {
        // Duplicate delivery — ignore, but acknowledge.
        res.status(200).json({});
        return;
      }

      const reply = await handleMessage(ctx, event);
      res.status(200).json(reply ? { text: reply } : {});
    } catch (err) {
      logger.error('Webhook processing error', { error: (err as Error).message });
      // Never surface internal errors to Google Chat.
      res.status(200).json({});
    }
  };
}

/** Process a MESSAGE event; returns an optional synchronous reply text. */
async function handleMessage(
  ctx: AppContext,
  event: Record<string, unknown>,
): Promise<string | null> {
  const message = event.message as Record<string, unknown>;
  const sender = (message.sender ?? {}) as Record<string, unknown>;
  const thread = (message.thread ?? {}) as Record<string, unknown>;
  // In a space, message.text includes the @mention; argumentText is the text
  // with the mention stripped — use it so slash commands work when mentioned.
  const argumentText = (message.argumentText as string) ?? '';
  const text = (argumentText || (message.text as string) || '').trim();
  const senderName = (sender.name as string) ?? ''; // e.g. users/12345
  const threadName = (thread.name as string) ?? ''; // e.g. spaces/A/threads/C

  const chatUserId = senderName.startsWith('users/') ? senderName.slice('users/'.length) : senderName;
  const employee = chatUserId ? await ctx.employees.findByChatUserId(chatUserId) : null;

  // Slash commands take priority.
  const commandReply = await handleCommand(ctx, text, employee);
  if (commandReply !== null) {
    logger.info('Handled command', { command: text.split(/\s+/)[0] });
    return commandReply;
  }

  // A reply only counts when it lands inside a thread the bot created.
  const open = threadName ? await ctx.checkIns.findOpenByThread(threadName) : null;
  if (!open) {
    // Not a check-in reply (e.g. a direct @mention). Give a short friendly ack
    // so the interaction never looks unanswered.
    logger.info('Mention/ack (no active check-in thread)', { senderName, threadName });
    return "👋 Hi! I'm here. Try /ping or /help 😄";
  }

  // Only the designated employee for this check-in completes the session.
  if (!employee || open.employeeId !== employee.id) {
    await ctx.checkIns.addMessage(open.id, 'SYSTEM', `Ignored reply from ${senderName}`);
    logger.info('Ignored non-designated reply in thread', { threadName, senderName });
    return null;
  }

  const updated = await ctx.checkIns.markResponded(open.id, new Date());
  if (updated) {
    await ctx.checkIns.addMessage(open.id, 'EMPLOYEE', text);
    logger.info('Employee replied', {
      employee: employee.name,
      leadTimeSeconds: updated.leadTimeSeconds,
    });
  }
  // No synchronous reply here; follow-ups are generated asynchronously in phase 2.
  return null;
}
