import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/admin/Sidebar';
import { Toaster } from '@/components/ui/toast';
import { CommandPalette } from '@/components/admin/CommandPalette';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { Fab } from '@/components/admin/Fab';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.authed) redirect('/login');

  return (
    <div className="min-h-[100dvh] flex">
      <Sidebar user={session.user} />
      <main id="main" className="flex-1 min-w-0 px-4 md:px-6 lg:px-8 py-5 md:py-6 pb-24 md:pb-6 pd-page-in">
        {children}
      </main>
      <Toaster />
      <CommandPalette />
      <ConfirmModal />
      <Fab />
    </div>
  );
}
