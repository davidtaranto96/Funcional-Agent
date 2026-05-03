import { listAllFolders } from '@/lib/document-folders';
import { DocumentosView } from './DocumentosView';

export const dynamic = 'force-dynamic';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function DocumentosPage() {
  const { custom, projects, demos, totalFiles, totalBytes } = await listAllFolders();

  return (
    <DocumentosView
      custom={custom}
      projects={projects}
      demos={demos}
      stats={{
        totalFiles,
        totalFolders: custom.length + projects.length + demos.length,
        usedLabel: formatBytes(totalBytes),
        capLabel: '~1 GB · Railway Volume',
        usedPct: Math.min(100, (totalBytes / (1024 * 1024 * 1024)) * 100),
      }}
    />
  );
}
