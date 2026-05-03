import { SkelHeader, SkelKpi, SkelCard } from '@/components/admin/Skeleton';

export default function LoadingFinanzas() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <SkelHeader />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => <SkelKpi key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="lg:col-span-2"><SkelCard rows={5} /></div>
        <SkelCard rows={6} />
      </div>
      <SkelCard rows={3} />
    </div>
  );
}
