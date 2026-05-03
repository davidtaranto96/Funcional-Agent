import { SkelHeader, SkelKpi, SkelCard } from '@/components/admin/Skeleton';

export default function LoadingDashboard() {
  return (
    <div className="max-w-[1280px] mx-auto">
      <SkelHeader />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-[18px]">
        {Array.from({ length: 4 }).map((_, i) => <SkelKpi key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <SkelCard rows={5} />
        <SkelCard rows={5} />
        <SkelCard rows={5} />
      </div>
    </div>
  );
}
