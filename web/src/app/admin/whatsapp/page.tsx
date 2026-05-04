import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { WhatsAppQRClient } from './QRClient';

export const dynamic = 'force-dynamic';

export default async function WhatsAppQRPage() {
  const session = await getSession();
  if (!session.authed) redirect('/login');

  return (
    <div className="max-w-[600px] mx-auto py-8">
      <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-1">
        Conectar WhatsApp
      </h1>
      <p className="text-[13px] text-muted-foreground mb-6">
        Vinculá un dispositivo WhatsApp escaneando este QR desde tu celular.
      </p>
      <WhatsAppQRClient />
    </div>
  );
}
