const { google } = require('googleapis');
const { Readable } = require('stream');

let driveClient;

// Lazy init: no romper al arrancar si falta la env var
function getDrive() {
  if (driveClient) return driveClient;

  const credsB64 = process.env.GOOGLE_DRIVE_CREDENTIALS;
  if (!credsB64) {
    throw new Error('GOOGLE_DRIVE_CREDENTIALS no está configurado');
  }

  const credentials = JSON.parse(Buffer.from(credsB64, 'base64').toString('utf-8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function getParentFolderId() {
  const id = (process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '').trim();
  if (!id) throw new Error('GOOGLE_DRIVE_PARENT_FOLDER_ID no está configurado');
  return id;
}

function slugify(str) {
  return (str || 'cliente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Crea una carpeta para el cliente dentro de la carpeta raíz
async function createClientFolder(clientName, phone) {
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

  return {
    id: res.data.id,
    name: folderName,
    webViewLink: res.data.webViewLink,
  };
}

// Sube un buffer como archivo a una carpeta
async function uploadFile(folderId, filename, buffer, mimeType) {
  const drive = getDrive();

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink, webContentLink',
  });

  return {
    id: res.data.id,
    webViewLink: res.data.webViewLink,
    webContentLink: res.data.webContentLink,
  };
}

// Atajo: subir un objeto JSON
async function uploadJSON(folderId, filename, obj) {
  const buffer = Buffer.from(JSON.stringify(obj, null, 2), 'utf-8');
  return uploadFile(folderId, filename, buffer, 'application/json');
}

// Hacer un archivo accesible públicamente (lectura)
async function makePublic(fileId) {
  const drive = getDrive();
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  const res = await drive.files.get({
    fileId,
    fields: 'webViewLink, webContentLink',
  });
  return res.data;
}

function isConfigured() {
  return !!(process.env.GOOGLE_DRIVE_CREDENTIALS && process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID);
}

module.exports = {
  createClientFolder,
  uploadFile,
  uploadJSON,
  makePublic,
  isConfigured,
};
