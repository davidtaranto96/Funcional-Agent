import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { processNewReport } from '@/lib/orchestrator';
import { requireAuth } from '@/lib/session';
import { publicUrl } from '@/lib/utils';
import type { ConversationReport } from '@/lib/db';

const DEMOS: Record<string, { phone: string; report: ConversationReport }> = {
  web: {
    phone: 'whatsapp:+5493878000001',
    report: {
      cliente: { nombre: 'Panadería El Hornito', telefono: '+5493878000001', email: 'hornito@demo.com' },
      proyecto: {
        tipo: 'Página web para panadería',
        descripcion: 'Página web para mostrar productos, horarios, hacer pedidos por WhatsApp y tener presencia online. El negocio está en el centro de Salta.',
        funcionalidades: ['Galería de productos con fotos', 'Horarios de atención', 'Botón de pedido por WhatsApp', 'Mapa de ubicación', 'Sección de promociones'],
        plataforma: 'web',
        estado_actual: 'Solo tienen Instagram',
      },
      requisitos: { plazo: '3 semanas', presupuesto: '$80.000 ARS', urgencia: 'media', stack_sugerido: '', notas_adicionales: 'Quieren colores cálidos, que se vea artesanal' },
      resumen_ejecutivo: 'Panadería familiar en el centro de Salta que necesita página web para mostrar sus productos y recibir pedidos por WhatsApp. Parten de cero, solo tienen Instagram.',
    },
  },
  bot: {
    phone: 'whatsapp:+5493878000002',
    report: {
      cliente: { nombre: 'Veterinaria PetCare', telefono: '+5493878000002', email: 'petcare@demo.com' },
      proyecto: {
        tipo: 'Bot de WhatsApp para veterinaria',
        descripcion: 'Bot de WhatsApp que responda consultas frecuentes, gestione turnos automáticamente y avise cuando está listo el turno.',
        funcionalidades: ['Agendar turnos automáticamente', 'Consultas de precios y servicios', 'Recordatorio de turno por WhatsApp', 'Historial de mascotas', 'Derivar a atención humana si es urgente'],
        plataforma: 'whatsapp',
        estado_actual: 'Atienden todo manualmente por WhatsApp',
      },
      requisitos: { plazo: '4 semanas', presupuesto: '$120.000 ARS', urgencia: 'alta', stack_sugerido: '', notas_adicionales: 'Mucho volumen en diciembre, necesitan automatizar antes de fin de año' },
      resumen_ejecutivo: 'Veterinaria con alto volumen de consultas que necesita un bot de WhatsApp para automatizar turnos y consultas frecuentes.',
    },
  },
  app: {
    phone: 'whatsapp:+5493878000003',
    report: {
      cliente: { nombre: 'Gimnasio FitMax', telefono: '+5493878000003', email: 'fitmax@demo.com' },
      proyecto: {
        tipo: 'App móvil para gimnasio',
        descripcion: 'App para que los socios del gimnasio vean clases, reserven lugares, paguen su cuota y controlen su asistencia desde el celular.',
        funcionalidades: ['Ver calendario de clases', 'Reservar lugar en clases', 'Pago de cuota online', 'Control de asistencia', 'Notificaciones de clases nuevas'],
        plataforma: 'app móvil (iOS/Android)',
        estado_actual: 'Todo manual en papel y WhatsApp',
      },
      requisitos: { plazo: '2 meses', presupuesto: '$300.000 ARS', urgencia: 'media', stack_sugerido: 'Flutter + Firebase', notas_adicionales: 'Colores negro y naranja flúo' },
      resumen_ejecutivo: 'Gimnasio en Salta que quiere digitalizar toda la gestión de socios con una app mobile completa.',
    },
  },
};

export async function POST(req: NextRequest) {
  await requireAuth();
  const formData = await req.formData().catch(() => null);
  const json = formData ? null : await req.json().catch(() => null);
  const tipo = String(formData?.get('tipo') || json?.tipo || 'web');
  const demo = DEMOS[tipo] || DEMOS.web;

  await db.upsertConversation(demo.phone, {
    history: [
      { role: 'user',      content: 'Hola, me interesa hacer un proyecto digital' },
      { role: 'assistant', content: '¡Hola! Soy el asistente de David. Contame qué necesitás.' },
      { role: 'user',      content: `Necesito ${demo.report.proyecto?.tipo?.toLowerCase()} para mi negocio` },
      { role: 'assistant', content: 'Perfecto, te entiendo. Armé un resumen de lo que me contaste...' },
    ],
    stage: 'done',
    context: { nombre: demo.report.cliente?.nombre || '' },
    report: demo.report,
  });
  await db.updateClientStage(demo.phone, 'qualified');
  await db.appendTimelineEvent(demo.phone, { event: 'report_generated', note: 'Lead de demo creado manualmente' });

  // Disparar generación de demos en background — no bloqueamos
  processNewReport(demo.phone, demo.report).catch(console.error);

  if (formData) {
    return NextResponse.redirect(publicUrl(req, `/admin/client/${encodeURIComponent(demo.phone)}`), { status: 303 });
  }
  return NextResponse.json({ ok: true, phone: demo.phone });
}
