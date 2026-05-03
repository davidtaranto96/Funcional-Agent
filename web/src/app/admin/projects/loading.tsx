import { SkelHeader, SkelKanban } from '@/components/admin/Skeleton';

export default function LoadingProjects() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <SkelHeader />
      <SkelKanban cols={5} />
    </div>
  );
}
