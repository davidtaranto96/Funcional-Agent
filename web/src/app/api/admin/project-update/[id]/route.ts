import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const formData = await req.formData();
  const text = String(formData.get('text') || '').trim();
  if (text) await db.addProjectUpdate(id, text);
  return NextResponse.redirect(new URL(`/admin/projects/${id}`, req.url), { status: 303 });
}
