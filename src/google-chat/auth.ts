import { X509Certificate, verify } from 'node:crypto';
import { getLogger } from '../utils/logger';

const logger = getLogger('google-chat');

// Google Chat signs HTTP-endpoint requests with a JWT issued by this account.
const CHAT_ISSUER = 'chat@system.gserviceaccount.com';
const CERTS_URL =
  'https://www.googleapis.com/service_accounts/v1/metadata/x509/chat@system.gserviceaccount.com';
const CERTS_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CertCache {
  certs: Record<string, string>;
  fetchedAt: number;
}
let cache: CertCache | null = null;

async function getCerts(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.fetchedAt < CERTS_TTL_MS) return cache.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Chat certs: ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;
  cache = { certs, fetchedAt: Date.now() };
  return certs;
}

function b64urlToBuffer(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

interface JwtPayload {
  iss?: string;
  aud?: string;
  exp?: number;
}

/**
 * Verify a Google Chat Bearer JWT: signature (against Google's rotating certs),
 * issuer, audience (project number) and expiry. Returns true only if all pass.
 */
export async function verifyChatJwt(token: string, audience: string): Promise<boolean> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return false;

    const header = JSON.parse(b64urlToBuffer(headerB64).toString('utf8')) as { kid?: string };
    const payload = JSON.parse(b64urlToBuffer(payloadB64).toString('utf8')) as JwtPayload;

    if (payload.iss !== CHAT_ISSUER) return false;
    if (payload.aud !== audience) return false;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return false;
    if (!header.kid) return false;

    const certs = await getCerts();
    const pem = certs[header.kid];
    if (!pem) return false;

    const publicKey = new X509Certificate(pem).publicKey;
    const signingInput = `${headerB64}.${payloadB64}`;
    return verify(
      'RSA-SHA256',
      Buffer.from(signingInput),
      publicKey,
      b64urlToBuffer(signatureB64),
    );
  } catch (err) {
    logger.warn('Chat JWT verification error', { error: (err as Error).message });
    return false;
  }
}
