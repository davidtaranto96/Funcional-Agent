import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

// JSON endpoint para drag-and-drop del kanban del pipeline
export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json();
  const phone = String(body?.phone || '');
  const newStage = String(body?.newStage || '');
  if (!phone || !newStage) return NextResponse.json({ error: 'phone + newStage required' }, { status: 400 });

  await db.updateClientStage(phone, newStage);
  await db.appendTimelineEvent(phone, { event: 'stage_changed', note: `Drag → ${newStage}` });
  return NextResponse.json({ ok: true });
}
