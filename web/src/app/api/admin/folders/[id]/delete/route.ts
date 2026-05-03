import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  await db.deleteDocumentFolder(id);
  return NextResponse.redirect(new URL('/admin/documentos', req.url), { status: 303 });
}
