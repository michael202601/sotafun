import { google, chat_v1 } from 'googleapis';
import { getLogger } from '../utils/logger';
import type { Env } from '../config/env';

const logger = getLogger('google-chat');
const SCOPES = ['https://www.googleapis.com/auth/chat.bot'];

export interface SentMessage {
  /** Full message resource name, e.g. spaces/AAA/messages/BBB. */
  messageId: string;
  /** Thread resource name, e.g. spaces/AAA/threads/CCC. */
  threadId: string;
}

/**
 * Wraps the Google Chat API using a service account. Handles sending new
 * threads, threaded replies and mentions, with retries on transient failures.
 */
export class GoogleChatService {
  private chat: chat_v1.Chat | null = null;
  /** Cache of userId -> DM space name to avoid repeated lookups. */
  private readonly dmCache = new Map<string, string>();

  constructor(private readonly env: Env) {}

  /**
   * Resolve the direct-message space between the bot and a user. Returns null
   * if no DM exists yet (the user must message the bot once — apps cannot create
   * a DM proactively without extra permissions).
   */
  async findDirectMessage(userId: string): Promise<string | null> {
    const cached = this.dmCache.get(userId);
    if (cached) return cached;
    try {
      const chat = await this.client();
      const res = await chat.spaces.findDirectMessage({ name: `users/${userId}` });
      const name = res.data.name ?? null;
      if (name) this.dmCache.set(userId, name);
      return name;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 404) return null; // no DM yet
      logger.warn('findDirectMessage failed', { userId, error: (err as Error).message });
      return null;
    }
  }

  private async client(): Promise<chat_v1.Chat> {
    if (this.chat) return this.chat;
    const auth = new google.auth.GoogleAuth({
      keyFile: this.env.GOOGLE_SERVICE_ACCOUNT_FILE,
      scopes: SCOPES,
    });
    this.chat = google.chat({ version: 'v1', auth });
    return this.chat;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client();
      return true;
    } catch (err) {
      logger.error('Google Chat auth failed', { error: (err as Error).message });
      return false;
    }
  }

  /** Send a new message that starts its own thread. Returns ids for tracking. */
  async sendNewThread(space: string, text: string): Promise<SentMessage> {
    return this.send(space, text, undefined);
  }

  /** Reply inside an existing thread (used for reminders and follow-ups). */
  async replyInThread(space: string, threadId: string, text: string): Promise<SentMessage> {
    return this.send(space, text, threadId);
  }

  /** Post a plain message to the manager space (reports/alerts). */
  async sendToManagers(text: string): Promise<SentMessage> {
    return this.send(this.env.GOOGLE_CHAT_MANAGER_SPACE, text, undefined);
  }

  /** Build a mention prefix for an employee's Google Chat user id. */
  static mention(googleChatUserId: string | null | undefined, name: string): string {
    if (!googleChatUserId) return name;
    return `<users/${googleChatUserId}>`;
  }

  private async send(
    space: string,
    text: string,
    threadId: string | undefined,
    attempts = 3,
  ): Promise<SentMessage> {
    const chat = await this.client();
    const requestBody: chat_v1.Schema$Message = { text };
    if (threadId) requestBody.thread = { name: threadId };

    let lastErr: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        const res = await chat.spaces.messages.create({
          parent: space,
          // Reply in the same thread when provided, else start a new one.
          messageReplyOption: threadId
            ? 'REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD'
            : undefined,
          requestBody,
        });
        return {
          messageId: res.data.name ?? '',
          threadId: res.data.thread?.name ?? threadId ?? '',
        };
      } catch (err) {
        lastErr = err;
        logger.warn(`Google Chat send failed (attempt ${i}/${attempts})`, {
          error: (err as Error).message,
        });
        if (i < attempts) await new Promise((r) => setTimeout(r, 300 * i));
      }
    }
    throw lastErr;
  }
}
