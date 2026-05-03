import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

  const items = Array.isArray(body.items) ? body.items.map((it: { description?: string; quantity?: number; unit_price?: number }) => ({
    description: String(it.description || ''),
    quantity: Number(it.quantity || 0),
    unit_price: Number(it.unit_price || 0),
  })) : [];
  const amount = items.reduce((s: number, it: { quantity: number; unit_price: number }) => s + (it.quantity * it.unit_price), 0);

  const id = await db.createInvoice({
    number: String(body.number || ''),
    client_id: String(body.client_id || ''),
    client_name: String(body.client_name || ''),
    project_id: String(body.project_id || ''),
    issue_date: String(body.issue_date || ''),
    due_date: String(body.due_date || ''),
    currency: String(body.currency || 'ARS'),
    status: String(body.status || 'draft'),
    notes: String(body.notes || ''),
    items,
    amount,
  });

  return NextResponse.json({ id });
}
