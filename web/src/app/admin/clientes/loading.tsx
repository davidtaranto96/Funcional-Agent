import { SkelHeader, SkelTable } from '@/components/admin/Skeleton';

export default function LoadingClientes() {
  return (
    <div className="max-w-[1280px] mx-auto">
      <SkelHeader />
      <SkelTable rows={8} cols={4} />
    </div>
  );
}
