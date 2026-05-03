import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

  const current = await db.getInvoice(id);
  if (!current) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  // Si vienen items, recalcular amount
  let items = current.items;
  let amount = current.amount;
  if (Array.isArray(body.items)) {
    items = body.items.map((it: { description?: string; quantity?: number; unit_price?: number }) => ({
      description: String(it.description || ''),
      quantity: Number(it.quantity || 0),
      unit_price: Number(it.unit_price || 0),
    }));
    amount = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
  }

  await db.updateInvoice(id, {
    number: body.number !== undefined ? String(body.number) : current.number,
    client_id: body.client_id !== undefined ? String(body.client_id) : current.client_id,
    client_name: body.client_name !== undefined ? String(body.client_name) : current.client_name,
    project_id: body.project_id !== undefined ? String(body.project_id) : current.project_id,
    issue_date: body.issue_date !== undefined ? String(body.issue_date) : current.issue_date,
    due_date: body.due_date !== undefined ? String(body.due_date) : current.due_date,
    currency: body.currency !== undefined ? String(body.currency) : current.currency,
    status: body.status !== undefined ? String(body.status) : current.status,
    notes: body.notes !== undefined ? String(body.notes) : current.notes,
    items,
    amount,
  });

  return NextResponse.json({ id });
}
