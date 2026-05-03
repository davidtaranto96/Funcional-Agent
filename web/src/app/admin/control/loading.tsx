import { SkelHeader, SkelCard } from '@/components/admin/Skeleton';
import { Skel } from '@/components/admin/Skeleton';

export default function LoadingControl() {
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Banner placeholder */}
      <div className="bg-card border border-[var(--border)] rounded-[var(--r-lg)] p-4 mb-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Skel w={40} h={40} radius="lg" />
            <div className="space-y-1.5">
              <Skel w={140} h={14} />
              <Skel w={260} h={11} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => <Skel key={i} w={64} h={20} radius="md" />)}
          </div>
        </div>
      </div>
      <SkelHeader />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SkelCard rows={3} />
            <SkelCard rows={3} />
          </div>
        </div>
        <div className="lg:col-span-2"><SkelCard rows={4} /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkelCard rows={5} />
        <SkelCard rows={5} />
        <SkelCard rows={5} />
      </div>
    </div>
  );
}
