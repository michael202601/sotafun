import type { Request, Response } from 'express';
import type { AppContext } from '../app/context';
import { getLogger } from '../utils/logger';
import { handleCommand } from './commands';

const logger = getLogger('google-chat');

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
      const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? req.query.token;
      if (token !== ctx.env.GOOGLE_CHAT_VERIFICATION_TOKEN) {
        logger.warn('Rejected webhook with invalid token');
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
  const text = (message.text as string) ?? '';
  const senderName = (sender.name as string) ?? ''; // e.g. users/12345

  const chatUserId = senderName.startsWith('users/') ? senderName.slice('users/'.length) : senderName;
  const employee = chatUserId ? await ctx.employees.findByChatUserId(chatUserId) : null;

  // Slash commands take priority.
  const commandReply = await handleCommand(ctx, text, employee);
  if (commandReply !== null) {
    logger.info('Handled command', { command: text.split(/\s+/)[0] });
    return commandReply;
  }

  // Otherwise treat as a check-in reply.
  if (employee) {
    const open = await ctx.checkIns.findOpenForEmployee(employee.id);
    if (open) {
      const updated = await ctx.checkIns.markResponded(open.id, new Date());
      if (updated) {
        await ctx.checkIns.addMessage(open.id, 'EMPLOYEE', text);
        logger.info('Employee replied', {
          employee: employee.name,
          leadTimeSeconds: updated.leadTimeSeconds,
        });
      }
    }
  }
  // No synchronous reply here; follow-ups are generated asynchronously in phase 2.
  return null;
}
