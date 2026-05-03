import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import * as db from '@/lib/db';
import { FolderView, type FolderFile } from './FolderView';

export const dynamic = 'force-dynamic';

const DOCUMENTS_DIR = path.resolve(process.cwd(), '..', 'data', 'documents');

function listFolderFiles(folderId: string): FolderFile[] {
  const dir = path.resolve(DOCUMENTS_DIR, folderId);
  if (!dir.startsWith(path.resolve(DOCUMENTS_DIR))) return [];
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .map(name => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (!stat.isFile()) return null;
        return {
          name,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          ext: path.extname(name).toLowerCase(),
        };
      })
      .filter((x): x is FolderFile => x !== null)
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

export default async function FolderDetailPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const folders = await db.listDocumentFolders();
  const folder = folders.find(f => f.id === id);
  if (!folder) notFound();

  const files = listFolderFiles(id);
  const otherFolders = folders
    .filter(f => f.id !== id)
    .map(f => ({ id: f.id, name: f.name, color: f.color }));

  return (
    <FolderView
      folder={{ id: folder.id, name: folder.name, color: folder.color, description: folder.description }}
      files={files}
      otherFolders={otherFolders}
    />
  );
}
