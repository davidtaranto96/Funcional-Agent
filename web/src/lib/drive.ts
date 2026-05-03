import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'stream';

let driveClient: drive_v3.Drive | null = null;

function getDrive(): drive_v3.Drive {
  if (driveClient) return driveClient;
  const credsB64 = process.env.GOOGLE_DRIVE_CREDENTIALS;
  if (!credsB64) throw new Error('GOOGLE_DRIVE_CREDENTIALS no está configurado');
  const credentials = JSON.parse(Buffer.from(credsB64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function getParentFolderId(): string {
  const id = (process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '').trim();
  if (!id) throw new Error('GOOGLE_DRIVE_PARENT_FOLDER_ID no está configurado');
  return id;
}

function slugify(str: string): string {
  return (str || 'cliente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function createClientFolder(clientName: string, phone: string) {
  const drive = getDrive();
  const parentId = getParentFolderId();
  const phoneClean = (phone || '').replace(/[^0-9]/g, '').slice(-10);
  const folderName = `${slugify(clientName)}-${phoneClean}`;

  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, webViewLink',
  });

  return { id: res.data.id, name: folderName, webViewLink: res.data.webViewLink };
}

export async function uploadFile(folderId: string, filename: string, buffer: Buffer, mimeType: string) {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, webViewLink, webContentLink',
  });
  return { id: res.data.id, webViewLink: res.data.webViewLink, webContentLink: res.data.webContentLink };
}

export async function uploadJSON(folderId: string, filename: string, obj: unknown) {
  const buffer = Buffer.from(JSON.stringify(obj, null, 2), 'utf-8');
  return uploadFile(folderId, filename, buffer, 'application/json');
}

export async function makePublic(fileId: string) {
  const drive = getDrive();
  await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
  const res = await drive.files.get({ fileId, fields: 'webViewLink, webContentLink' });
  return res.data;
}

export function isConfigured(): boolean {
  return !!(process.env.GOOGLE_DRIVE_CREDENTIALS && process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID);
}
