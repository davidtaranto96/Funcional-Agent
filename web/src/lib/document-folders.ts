// Resolver unificado de "carpetas de documentos".
//
// IMPORTANTE: las operaciones de filesystem se delegan al servicio Funcional-Agent
// (Express) via lib/file-proxy.ts, porque el volume vive en ese servicio y Next.js
// no tiene acceso directo. Acá solo re-exportamos los tipos y wrappers.

export {
  listAllFolders,
  getFolderWithFiles,
  type FolderListing,
  type FolderFile,
  type FolderInfo,
  type FolderType,
  type AllFoldersResult,
  type FolderWithFilesResult,
} from './file-proxy';
