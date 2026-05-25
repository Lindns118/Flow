import { getToken } from './googleAuth';

const FILE_NAME = 'flow-data.json';
const EXPORT_FILE_NAME = 'flow-notes-backup.json';
const LAST_EXPORT_KEY = 'lastNoteExport';
const EXPORT_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

async function findFileId() {
  const res = await fetch(
    `${DRIVE_API}/files?spaces=appDataFolder&q=name%3D'${FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

async function findExportFileId() {
  const q = encodeURIComponent(`name='${EXPORT_FILE_NAME}' and trashed=false`);
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

export async function loadDataFromDrive() {
  const fileId = await findFileId();
  if (!fileId) return null;
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Fallback: load from the visible backup file if primary is missing/corrupted
export async function loadBackupFromDrive() {
  const fileId = await findExportFileId();
  if (!fileId) return null;
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export function shouldExport() {
  const last = parseInt(localStorage.getItem(LAST_EXPORT_KEY) || '0');
  return Date.now() - last >= EXPORT_INTERVAL_MS;
}

async function uploadExportFile(body) {
  const fileId = await findExportFileId();
  if (fileId) {
    const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error('Échec de la mise à jour du backup Drive');
  } else {
    const metadata = JSON.stringify({ name: EXPORT_FILE_NAME });
    const form = new FormData();
    form.append('metadata', new Blob([metadata], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    });
    if (!res.ok) throw new Error('Échec de la création du backup Drive');
  }
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
}

export async function exportNotesToDrive(data) {
  await uploadExportFile(JSON.stringify(data));
}

export async function saveDataToDrive(data) {
  const fileId = await findFileId();
  const body = JSON.stringify(data);

  if (fileId) {
    await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body,
    });
  } else {
    const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
    const form = new FormData();
    form.append('metadata', new Blob([metadata], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    });
  }
}
