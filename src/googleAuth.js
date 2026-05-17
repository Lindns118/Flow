const CLIENT_ID = '112387534657-dp9jk1uaqrrch1t0n7o9t118kivtjj72.apps.googleusercontent.com';
const ALLOWED_EMAIL = 'francois.lecrenier@gmail.com';

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata email profile';

let tokenClient = null;
let userInfo = null;
let accessToken = sessionStorage.getItem('gToken') || null;

function loadGisScript() {
  return new Promise((resolve) => {
    if (window.google?.accounts) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

export async function initGoogleAuth() {
  await loadGisScript();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  });
}

async function fetchUserInfo(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export function signIn() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (response) => {
      if (response.error) { reject(new Error(response.error)); return; }
      const token = response.access_token;
      const info = await fetchUserInfo(token);
      if (!info?.email) {
        reject(new Error('Impossible de récupérer le profil Google'));
        return;
      }
      if (info.email !== ALLOWED_EMAIL) {
        google.accounts.oauth2.revoke(token, () => {});
        reject(new Error('Accès non autorisé pour ce compte Google'));
        return;
      }
      accessToken = token;
      userInfo = info;
      sessionStorage.setItem('gToken', token);
      resolve(info);
    };
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
}

export function signOut() {
  const token = accessToken;
  accessToken = null;
  userInfo = null;
  sessionStorage.removeItem('gToken');
  if (token && window.google?.accounts) {
    google.accounts.oauth2.revoke(token, () => {});
  }
}

export function getToken() { return accessToken; }
export function isSignedIn() { return !!accessToken; }
export function getUserInfo() { return userInfo; }

export async function tryRestoreSession() {
  if (!accessToken) return false;
  const info = await fetchUserInfo(accessToken);
  if (!info?.email || info.email !== ALLOWED_EMAIL) {
    signOut();
    return false;
  }
  userInfo = info;
  return true;
}
