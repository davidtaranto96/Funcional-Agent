import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest) {
  await requireAuth();
  const formData = await req.formData();
  const name = String(formData.get('name') || '').trim();
  const id = await db.createClientRecord({
    name,
    phone: String(formData.get('phone') || ''),
    email: String(formData.get('email') || ''),
    company: String(formData.get('company') || ''),
    category: String(formData.get('category') || 'cliente'),
    notes: String(formData.get('notes') || ''),
  });
  // Auto-crear carpeta de documentos para este cliente (best-effort, no rompe si falla)
  try {
    if (name) {
      await db.createDocumentFolder({
        name: `Cliente · ${name}`,
        color: '#3b82f6',
        description: `Documentos asociados a ${name}`,
      });
    }
  } catch { /* best-effort */ }
  return NextResponse.redirect(publicUrl(req, `/admin/clientes/${id}`), { status: 303 });
}
