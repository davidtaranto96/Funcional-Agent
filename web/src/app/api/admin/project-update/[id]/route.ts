import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const formData = await req.formData();
  const text = String(formData.get('text') || '').trim();
  if (text) await db.addProjectUpdate(id, text);
  return NextResponse.redirect(publicUrl(req, `/admin/projects/${id}`), { status: 303 });
}
