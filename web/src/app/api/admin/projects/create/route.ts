import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest) {
  await requireAuth();
  const formData = await req.formData();
  const id = await db.createProject({
    title: String(formData.get('title') || ''),
    type: String(formData.get('type') || ''),
    description: String(formData.get('description') || ''),
    status: String(formData.get('status') || 'planning'),
    client_name: String(formData.get('client_name') || ''),
    client_phone: String(formData.get('client_phone') || ''),
    client_email: String(formData.get('client_email') || ''),
    client_id: String(formData.get('client_id') || ''),
    category: String(formData.get('category') || 'cliente'),
    is_personal: formData.get('is_personal') === 'on',
    deadline: String(formData.get('deadline') || '') || null,
    budget: String(formData.get('budget') || ''),
    notes: String(formData.get('notes') || ''),
  });
  return NextResponse.redirect(new URL(`/admin/projects/${id}`, req.url), { status: 303 });
}
