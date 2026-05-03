import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest) {
  await requireAuth();
  const formData = await req.formData();
  const id = await db.createClientRecord({
    name: String(formData.get('name') || ''),
    phone: String(formData.get('phone') || ''),
    email: String(formData.get('email') || ''),
    company: String(formData.get('company') || ''),
    category: String(formData.get('category') || 'cliente'),
    notes: String(formData.get('notes') || ''),
  });
  return NextResponse.redirect(publicUrl(req, `/admin/clientes/${id}`), { status: 303 });
}
