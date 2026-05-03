import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function GET() {
  await requireAuth();
  const count = await db.getUnreadNotificationCount();
  return NextResponse.json({ count });
}
