import { NextRequest, NextResponse } from 'next/server';
import { requireAdminToken } from '@/lib/session';

export async function GET(req: NextRequest) {
  const auth = requireAdminToken(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const check = (v: string) => process.env[v] ? '✅' : '❌ FALTA';
  return NextResponse.json({
    version: '5.0.0-alpha.1',
    env: {
      TWILIO_ACCOUNT_SID: check('TWILIO_ACCOUNT_SID'),
      TWILIO_AUTH_TOKEN: check('TWILIO_AUTH_TOKEN'),
      TWILIO_WHATSAPP_NUMBER: check('TWILIO_WHATSAPP_NUMBER'),
      ANTHROPIC_API_KEY: check('ANTHROPIC_API_KEY'),
      GROQ_API_KEY: check('GROQ_API_KEY'),
      DAVID_PHONE: check('DAVID_PHONE'),
      GOOGLE_REFRESH_TOKEN: check('GOOGLE_REFRESH_TOKEN'),
      ADMIN_API_TOKEN: check('ADMIN_API_TOKEN'),
      ADMIN_SESSION_SECRET: check('ADMIN_SESSION_SECRET'),
      ADMIN_PASSWORD: check('ADMIN_PASSWORD'),
    },
  });
}
