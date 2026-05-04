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
  const result = await listAllFolders().catch(err => {
    console.error('[documentos] proxy fail:', err);
    return { custom: [], projects: [], demos: [], totalFiles: 0, totalBytes: 0 };
  });

  return (
    <DocumentosView
      custom={result.custom}
      projects={result.projects}
      demos={result.demos}
      stats={{
        totalFiles: result.totalFiles,
        totalFolders: result.custom.length + result.projects.length + result.demos.length,
        usedLabel: formatBytes(result.totalBytes),
        capLabel: '~1 GB · Railway Volume',
        usedPct: Math.min(100, (result.totalBytes / (1024 * 1024 * 1024)) * 100),
      }}
    />
  );
}
