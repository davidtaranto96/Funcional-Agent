import twilio from 'twilio';
import { headers } from 'next/headers';

/**
 * Valida X-Twilio-Signature contra la URL pública + body parseado.
 * En NODE_ENV !== 'production' permite skipear (solo dev local con ngrok).
 *
 * Twilio firma con: HMAC-SHA1(authToken, fullURL + sortedFormParamsConcatenated)
 */
export async function validateTwilioSignature(
  url: string,
  body: Record<string, string>,
  signature: string | null,
): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') {
    if (!signature) {
      console.warn('[twilio-verify] dev mode — skip sig validation (no signature header)');
      return true;
    }
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio-verify] TWILIO_AUTH_TOKEN missing');
    return false;
  }
  if (!signature) return false;

  return twilio.validateRequest(authToken, signature, url, body);
}

/**
 * Reconstruye la URL pública del webhook detectando el proxy de Railway.
 */
export async function getPublicUrl(req: Request): Promise<string> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') || 'https';
  const host = h.get('x-forwarded-host') || h.get('host') || new URL(req.url).host;
  const pathname = new URL(req.url).pathname;
  const search = new URL(req.url).search;
  return `${proto}://${host}${pathname}${search}`;
}
