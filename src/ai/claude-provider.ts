import { spawn } from 'node:child_process';
import { getLogger } from '../utils/logger';
import type { AIProvider } from './types';
import type { Env } from '../config/env';

const logger = getLogger('claude');

/**
 * Invokes Claude Code via the local CLI, reusing the machine's authenticated
 * OAuth session. Authentication details never leave the CLI process.
 */
export class ClaudeCodeProvider implements AIProvider {
  readonly name = 'claude-code';

  constructor(private readonly env: Env) {}

  async isAvailable(): Promise<boolean> {
    if (!this.env.CLAUDE_CODE_ENABLED) return false;
    try {
      await this.run(['--version'], '', 10000);
      return true;
    } catch {
      return false;
    }
  }

  async generate(prompt: string): Promise<string> {
    // `-p` runs a single non-interactive prompt and prints the text result.
    const out = await this.run(['-p', prompt], '', this.env.CLAUDE_TIMEOUT_MS);
    return out.trim();
  }

  /** Spawn the CLI, feed optional stdin, enforce a timeout, return stdout. */
  private run(args: string[], stdin: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.env.CLAUDE_CODE_BIN, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        logger.warn('Claude Code timed out', { timeoutMs });
        reject(new Error(`Claude Code timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude Code exited ${code}: ${stderr.trim()}`));
        }
      });

      if (stdin) child.stdin.write(stdin);
      child.stdin.end();
    });
  }
}
