import { NextRequest, NextResponse } from 'next/server';
import { requireAdminToken } from '@/lib/session';
import { getLastWebhooks } from '../route';

export async function GET(req: NextRequest) {
  const auth = requireAdminToken(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });
  return NextResponse.json(getLastWebhooks());
}
