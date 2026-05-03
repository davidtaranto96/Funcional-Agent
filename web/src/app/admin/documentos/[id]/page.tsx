import { notFound } from 'next/navigation';
import { resolveFolder, listFolderFiles, listAllFolders } from '@/lib/document-folders';
import { FolderView } from './FolderView';

export const dynamic = 'force-dynamic';

export default async function FolderDetailPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const folder = await resolveFolder(id);
  if (!folder) notFound();

  const files = listFolderFiles(folder.dir);

  // Listar otras carpetas (custom + project + demo) excluyendo la actual,
  // como destino para "Mover archivo a..."
  const all = await listAllFolders();
  const otherFolders = [...all.custom, ...all.projects, ...all.demos]
    .filter(f => f.id !== folder.id)
    .map(f => ({ id: f.id, name: f.name, color: f.color, type: f.type }));

  return (
    <FolderView
      folder={{
        id: folder.id,
        name: folder.name,
        color: folder.color,
        description: folder.description,
        type: folder.type,
        subtitle: folder.subtitle,
      }}
      files={files}
      otherFolders={otherFolders}
    />
  );
}
