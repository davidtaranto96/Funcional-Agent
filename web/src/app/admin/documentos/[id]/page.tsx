import { notFound } from 'next/navigation';
import { getFolderWithFiles, listAllFolders } from '@/lib/file-proxy';
import { FolderView } from './FolderView';

export const dynamic = 'force-dynamic';

export default async function FolderDetailPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await getFolderWithFiles(id).catch(() => null);
  if (!result) notFound();

  // Listar otras carpetas (custom + project + demo) excluyendo la actual,
  // como destino para "Mover archivo a..."
  const all = await listAllFolders().catch(() => ({ custom: [], projects: [], demos: [] }));
  const otherFolders = [...all.custom, ...all.projects, ...all.demos]
    .filter(f => f.id !== result.folder.id)
    .map(f => ({ id: f.id, name: f.name, color: f.color, type: f.type }));

  return (
    <FolderView
      folder={result.folder}
      files={result.files}
      otherFolders={otherFolders}
    />
  );
}
