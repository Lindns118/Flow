const CLIENT_ID = '112387534657-dp9jk1uaqrrch1t0n7o9t118kivtjj72.apps.googleusercontent.com';
const ALLOWED_EMAIL = 'francois.lecrenier@gmail.com';

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file email profile';
const TOKEN_KEY = 'gToken';
const EXPIRY_KEY = 'gTokenExpiry';

let tokenClient = null;
let userInfo = null;

// Restore token from localStorage, discard if expired
let accessToken = (() => {
  const t = localStorage.getItem(TOKEN_KEY);
  const exp = parseInt(localStorage.getItem(EXPIRY_KEY) || '0');
  if (t && Date.now() < exp - 5 * 60 * 1000) return t; // valid with 5min buffer
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  return null;
})();

function saveToken(token, expiresIn = 3600) {
  accessToken = token;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
}

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

function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (response) => {
      if (response.error) { reject(new Error(response.error)); return; }
      const token = response.access_token;
      const info = await fetchUserInfo(token);
      if (!info?.email) { reject(new Error('Impossible de récupérer le profil Google')); return; }
      if (info.email !== ALLOWED_EMAIL) {
        google.accounts.oauth2.revoke(token, () => {});
        reject(new Error('Accès non autorisé pour ce compte Google'));
        return;
      }
      saveToken(token, response.expires_in);
      userInfo = info;
      resolve(info);
    };
    tokenClient.requestAccessToken({ prompt });
  });
}

export function signIn() {
  return requestToken('select_account');
}

// Silent re-auth: no popup if user is already signed into Google in this browser
export function silentSignIn() {
  return requestToken('');
}

export function signOut() {
  const token = accessToken;
  accessToken = null;
  userInfo = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  if (token && window.google?.accounts) {
    google.accounts.oauth2.revoke(token, () => {});
  }
}

export function getToken() { return accessToken; }
export function isSignedIn() { return !!accessToken; }
export function getUserInfo() { return userInfo; }

export async function tryRestoreSession() {
  // Try existing valid token
  if (accessToken) {
    const info = await fetchUserInfo(accessToken);
    if (info?.email === ALLOWED_EMAIL) {
      userInfo = info;
      return true;
    }
    // Token rejected, clear it
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    accessToken = null;
  }

  // Try silent re-auth (no popup if browser has active Google session)
  try {
    await silentSignIn();
    return true;
  } catch {
    return false;
  }
}
