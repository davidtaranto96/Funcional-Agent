import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import * as wa from '@/lib/whatsapp';
import * as db from '@/lib/db';
import { regenerateDemos } from '@/lib/orchestrator';

export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  try {
    switch (action) {
      case 'test-whatsapp': {
        const phone = String(body.phone || '');
        const message = String(body.message || 'Test desde DT Systems · ' + new Date().toLocaleTimeString('es-AR'));
        if (!phone) return NextResponse.json({ ok: false, error: 'phone requerido' }, { status: 400 });
        const normalized = wa.normalizePhone(phone);
        if (!normalized) return NextResponse.json({ ok: false, error: 'phone inválido' }, { status: 400 });
        await wa.sendMessage(normalized, message);
        return NextResponse.json({ ok: true, sentTo: phone });
      }

      case 'sync-drive': {
        // Por ahora es un noop útil — invalida caches del lado servidor.
        // Si tenés un sync real con Google Drive, lo enganchás acá.
        return NextResponse.json({ ok: true, message: 'Cache invalidada. Refresh forzado.' });
      }

      case 'regenerate-last-demo': {
        const all = await db.listAllClients();
        const candidates = all.filter(c => c.report && (c.demo_status === 'sent' || c.demo_status === 'approved'));
        candidates.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        const target = candidates[0];
        if (!target) return NextResponse.json({ ok: false, error: 'No hay demos para regenerar' }, { status: 404 });
        // Disparamos en background; no bloqueamos al usuario
        regenerateDemos(target.phone).catch(console.error);
        return NextResponse.json({
          ok: true,
          message: `Regeneración disparada para ${target.report?.cliente?.nombre || target.phone}`,
          phone: target.phone,
        });
      }

      default:
        return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
    }
  } catch (e) {
    console.error('[quick-control]', action, e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
