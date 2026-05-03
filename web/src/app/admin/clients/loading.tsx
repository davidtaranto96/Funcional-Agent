import { SkelHeader, SkelKanban } from '@/components/admin/Skeleton';

export default function LoadingClients() {
  return (
    <div className="max-w-[1600px] mx-auto">
      <SkelHeader />
      <div className="h-9 mb-4" />
      <SkelKanban cols={6} />
    </div>
  );
}
