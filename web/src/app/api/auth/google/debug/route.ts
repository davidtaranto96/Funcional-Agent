import { NextRequest, NextResponse } from 'next/server';
import { publicUrl } from '@/lib/utils';

/**
 * Endpoint público de diagnóstico OAuth.
 * No expone secrets — solo prefijos y URIs públicas. Sirve para verificar
 * exactamente qué redirect_uri se manda a Google y descartar mismatches.
 *
 * Hit: https://dt-systems.up.railway.app/api/auth/google/debug
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const hasSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const allowedEmailsRaw = process.env.ADMIN_ALLOWED_EMAILS || '';
  const allowedCount = allowedEmailsRaw ? allowedEmailsRaw.split(',').filter(Boolean).length : 0;
  const explicitRedirect = process.env.GOOGLE_REDIRECT_URI || '';
  const computedRedirect = publicUrl(req, '/api/auth/google/callback').toString();
  const effectiveRedirect = (explicitRedirect || computedRedirect).trim();

  return NextResponse.json({
    ok: true,
    env: {
      GOOGLE_CLIENT_ID_present: Boolean(clientId),
      // client_id es público (se ve en cada redirect a Google), se muestra entero para comparar
      GOOGLE_CLIENT_ID_value: clientId,
      GOOGLE_CLIENT_SECRET_present: hasSecret,
      GOOGLE_REDIRECT_URI_override: explicitRedirect || null,
      ADMIN_ALLOWED_EMAILS_count: allowedCount,
      ADMIN_ALLOWED_EMAILS_status: allowedCount === 0 ? 'EMPTY (cualquier email Google será aceptado)' : 'configurado',
    },
    request: {
      url: req.url,
      host: req.headers.get('host'),
      x_forwarded_host: req.headers.get('x-forwarded-host'),
      x_forwarded_proto: req.headers.get('x-forwarded-proto'),
    },
    redirect_uri: {
      computed_from_request: computedRedirect,
      effective_sent_to_google: effectiveRedirect,
      help: 'Esta URI debe estar EXACTAMENTE en Google Cloud Console > Credentials > tu Web client > Authorized redirect URIs (case-sensitive, sin trailing slash extra).',
    },
  }, { status: 200 });
}
