import { SkelHeader, SkelCard } from '@/components/admin/Skeleton';

export default function LoadingTasks() {
  return (
    <div className="max-w-[1280px] mx-auto">
      <SkelHeader />
      <div className="space-y-5">
        <SkelCard rows={4} />
        <SkelCard rows={6} />
        <SkelCard rows={3} />
      </div>
    </div>
  );
}
