import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest) {
  await requireAuth();
  const formData = await req.formData();
  const title = String(formData.get('title') || '').trim();
  const clientName = String(formData.get('client_name') || '').trim();
  const id = await db.createProject({
    title,
    type: String(formData.get('type') || ''),
    description: String(formData.get('description') || ''),
    status: String(formData.get('status') || 'planning'),
    client_name: clientName,
    client_phone: String(formData.get('client_phone') || ''),
    client_email: String(formData.get('client_email') || ''),
    client_id: String(formData.get('client_id') || ''),
    category: String(formData.get('category') || 'cliente'),
    is_personal: formData.get('is_personal') === 'on',
    deadline: String(formData.get('deadline') || '') || null,
    budget: String(formData.get('budget') || ''),
    notes: String(formData.get('notes') || ''),
  });
  // Auto-crear carpeta de documentos para este proyecto
  try {
    if (title) {
      const label = clientName ? `${title} (${clientName})` : title;
      await db.createDocumentFolder({
        name: `Proyecto · ${label}`,
        color: '#8b5cf6',
        description: `Documentos del proyecto ${title}`,
      });
    }
  } catch { /* best-effort */ }
  return NextResponse.redirect(publicUrl(req, `/admin/projects/${id}`), { status: 303 });
}
