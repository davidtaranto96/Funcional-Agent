import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session.authed) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const [convs, projects, clientRecords] = await Promise.all([
      db.listAllClients(),
      db.listProjects(),
      db.listClientRecords().catch(() => []),
    ]);

    const items = [
      ...convs.slice(0, 30).map(c => ({
        type: 'client' as const,
        title: c.report?.cliente?.nombre || c.phone,
        sub: `${c.phone}${c.report?.proyecto?.tipo ? ' · ' + c.report.proyecto.tipo : ''}`,
        href: `/admin/client/${encodeURIComponent(c.phone)}`,
      })),
      ...projects.slice(0, 30).map(p => ({
        type: 'project' as const,
        title: p.title || 'Sin nombre',
        sub: `${p.client_name || 'Personal'} · ${p.status}`,
        href: `/admin/projects/${p.id}`,
      })),
      ...clientRecords.slice(0, 30).map(c => ({
        type: 'contact' as const,
        title: c.name,
        sub: `${c.email || c.phone || ''}${c.company ? ' · ' + c.company : ''}`,
        href: `/admin/clientes/${c.id}`,
      })),
    ];

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error('[search] error', e);
    return NextResponse.json({ ok: true, items: [] });
  }
}
