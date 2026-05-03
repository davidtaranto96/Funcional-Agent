import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import type { Task } from '@/lib/constants';

interface MoveBody { projectId: string; taskIdx: number; newStatus: 'todo' | 'in_progress' | 'done' }

export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json() as MoveBody;
  const { projectId, taskIdx, newStatus } = body;
  if (!projectId || newStatus === undefined || taskIdx === undefined) {
    return NextResponse.json({ error: 'projectId + taskIdx + newStatus required' }, { status: 400 });
  }

  const project = await db.getProject(projectId);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const tasks = (project.tasks || []) as Task[];
  if (!tasks[taskIdx]) return NextResponse.json({ error: 'task not found' }, { status: 404 });

  tasks[taskIdx].status = newStatus === 'done' ? 'done' : newStatus === 'in_progress' ? 'in_progress' : 'todo';
  tasks[taskIdx].done = newStatus === 'done';

  await db.updateProject(projectId, { ...project, tasks });
  return NextResponse.json({ ok: true });
}
