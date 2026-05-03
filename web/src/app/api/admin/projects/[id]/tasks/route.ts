import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import type { Task } from '@/lib/constants';
import { publicUrl } from '@/lib/utils';

// POST: agrega o updatea tasks (form-based redirect, JSON-based for live updates)
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const project = await db.getProject(id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await req.json() as { action: string; idx?: number; task?: Task };
    const tasks = (project.tasks || []) as Task[];
    if (body.action === 'add' && body.task) {
      tasks.push(body.task);
    } else if (body.action === 'toggle' && typeof body.idx === 'number') {
      if (tasks[body.idx]) {
        tasks[body.idx].done = !tasks[body.idx].done;
        if (tasks[body.idx].done) tasks[body.idx].status = 'done';
        else tasks[body.idx].status = 'todo';
      }
    } else if (body.action === 'delete' && typeof body.idx === 'number') {
      tasks.splice(body.idx, 1);
    } else if (body.action === 'update' && typeof body.idx === 'number' && body.task) {
      tasks[body.idx] = { ...tasks[body.idx], ...body.task };
    }
    await db.updateProject(id, { ...project, tasks });
    return NextResponse.json({ ok: true, tasks });
  }

  // form-based add
  const formData = await req.formData();
  const text = String(formData.get('text') || '').trim();
  const priority = String(formData.get('priority') || 'medium') as Task['priority'];
  const assignee = String(formData.get('assignee') || 'david') as Task['assignee'];
  if (text) {
    const tasks = (project.tasks || []) as Task[];
    tasks.push({ text, done: false, status: 'todo', priority, assignee });
    await db.updateProject(id, { ...project, tasks });
  }
  return NextResponse.redirect(publicUrl(req, `/admin/projects/${id}`), { status: 303 });
}
