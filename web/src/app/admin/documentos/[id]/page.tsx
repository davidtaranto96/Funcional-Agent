import { notFound } from 'next/navigation';
import { getFolderWithFiles, listFolderTargets } from '@/lib/document-folders';
import { FolderView } from './FolderView';

export const dynamic = 'force-dynamic';

export default async function FolderDetailPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Paralelo: contenido de la carpeta + lista liviana de destinos para "mover".
  // Antes esto era secuencial y la lista de destinos hacia countFiles() en TODAS
  // las carpetas (proyectos + demos + custom). Ahora listFolderTargets() solo
  // toca DB, sin filesystem.
  const [result, targets] = await Promise.all([
    getFolderWithFiles(id).catch(() => null),
    listFolderTargets(id).catch(() => []),
  ]);

  if (!result) notFound();

  return (
    <FolderView
      folder={result.folder}
      files={result.files}
      otherFolders={targets}
    />
  );
}
