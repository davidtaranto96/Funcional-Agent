import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest) {
  await requireAuth();
  const formData = await req.formData();
  await db.createDocumentFolder({
    name: String(formData.get('name') || 'Sin nombre'),
    color: String(formData.get('color') || '#3b82f6'),
    description: String(formData.get('description') || ''),
  });
  return NextResponse.redirect(new URL('/admin/documentos', req.url), { status: 303 });
}
