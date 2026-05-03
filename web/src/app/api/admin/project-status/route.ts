import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

// JSON endpoint para drag-and-drop kanban de projects
export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json();
  const projectId = String(body?.projectId || '');
  const newStatus = String(body?.newStatus || '');
  if (!projectId || !newStatus) return NextResponse.json({ error: 'projectId + newStatus required' }, { status: 400 });

  await db.updateProjectStatus(projectId, newStatus);
  return NextResponse.json({ ok: true });
}
