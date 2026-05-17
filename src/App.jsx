import { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './index.css';
import Calculator from './pages/Calculator';
import Personne from './pages/Personne';
import Pierre from './pages/Pierre';
import NotesClients from './pages/NotesClients';
import Personnes from './pages/Personnes';
import { getPersonnes, getAllData, setAllData, setDriveSyncCallback, getNotes, saveNotes } from './db';
import { initGoogleAuth, signIn, signOut, isSignedIn, tryRestoreSession, getUserInfo } from './googleAuth';
import { loadDataFromDrive, saveDataToDrive } from './googleDrive';
import { historicalNotes } from './historicalNotes';

function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn();
      await onLogin();
    } catch (e) {
      setError(e.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 20, background: '#111',
    }}>
      <h1 style={{ color: '#fff', letterSpacing: 4, fontSize: 28, margin: 0 }}>FLOW</h1>
      <p style={{ color: '#aaa', margin: 0, fontSize: 14 }}>Salaires &amp; Notes Clients</p>
      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          marginTop: 16, padding: '12px 28px', fontSize: 15, borderRadius: 8,
          border: 'none', background: '#fff', color: '#222', fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.5 33.3 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.2-2.7-.5-4z"/>
          <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.3 6.1 29.4 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/>
          <path fill="#FBBC05" d="M24 44c5.2 0 9.9-1.8 13.6-4.7l-6.3-5.2C29.5 35.6 26.9 36.5 24 36.5c-5.8 0-10.6-3.9-12.3-9.2l-7 5.4C8.2 40 15.6 44 24 44z"/>
          <path fill="#EA4335" d="M43.6 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.3 5.8l6.3 5.2C41.5 36.3 44 30.6 44 24c0-1.3-.2-2.7-.4-4z"/>
        </svg>
        {loading ? 'Connexion...' : 'Se connecter avec Google'}
      </button>
      {error && (
        <p style={{ color: '#ff6b6b', fontSize: 14, margin: 0, maxWidth: 300, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function Navbar({ onLogout, onImportHistorique }) {
  const [showPanel, setShowPanel] = useState(false);
  const [personnes, setPersonnes] = useState([]);
  const [importMsg, setImportMsg] = useState('');
  const clickCountRef = useRef(0);
  const timerRef = useRef(null);
  const navigate = useNavigate();
  const user = getUserInfo();

  const handleImport = () => {
    const existing = getNotes();
    const existingIds = new Set(existing.map((n) => n.id));
    const toAdd = historicalNotes.filter((n) => !existingIds.has(n.id));
    if (toAdd.length === 0) { setImportMsg('Déjà importé'); return; }
    saveNotes([...existing, ...toAdd]);
    onImportHistorique();
    setImportMsg(`✓ ${toAdd.length} notes importées`);
    setTimeout(() => setImportMsg(''), 3000);
  };

  const handleTitleClick = () => {
    clickCountRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (clickCountRef.current >= 3) {
        const ps = getPersonnes();
        setPersonnes(ps);
        setShowPanel((v) => !v);
      }
      clickCountRef.current = 0;
    }, 400);
  };

  const handlePersonnesIconClick = () => {
    setShowPanel(false);
    navigate('/notes-clients');
  };

  return (
    <div className="navbar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span className="navbar-title" onClick={handleTitleClick}>
        SALAIRES &amp; NOTES CLIENTS
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user?.picture && (
          <img src={user.picture} alt="profil" style={{ width: 28, height: 28, borderRadius: '50%' }} />
        )}
        <button
          onClick={onLogout}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff', borderRadius: 6, padding: '4px 10px',
            cursor: 'pointer', fontSize: 12,
          }}
        >
          Déconnexion
        </button>
      </div>
      {showPanel && (
        <div className="hidden-panel">
          <Link to="/pierre" onClick={() => setShowPanel(false)}>⭐ Pierre</Link>
          {personnes.map((p) => (
            <Link key={p.key} to={`/personne/${p.key}`} onClick={() => setShowPanel(false)}>
              {p.nom}
            </Link>
          ))}
          <span onClick={handlePersonnesIconClick}>👥 Notes clients</span>
          <span onClick={handleImport} style={{ color: '#f59e0b', cursor: 'pointer' }}>
            📥 Importer historique
          </span>
          {importMsg && <span style={{ color: '#10b981', fontSize: 12 }}>{importMsg}</span>}
        </div>
      )}
    </div>
  );
}

function AppContent({ onLogout, onImportHistorique }) {
  return (
    <BrowserRouter basename="/Flow">
      <Navbar onLogout={onLogout} onImportHistorique={onImportHistorique} />
      <Routes>
        <Route path="/" element={<Calculator />} />
        <Route path="/personne/:key" element={<Personne />} />
        <Route path="/pierre" element={<Pierre />} />
        <Route path="/notes-clients" element={<NotesClients />} />
        <Route path="/personnes" element={<Personnes />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const setupDriveSync = () => {
    setDriveSyncCallback(() => saveDataToDrive(getAllData()));
  };

  const loadFromDrive = async () => {
    const driveData = await loadDataFromDrive();
    if (driveData) setAllData(driveData);
    setupDriveSync();
    setDataLoaded(true);
  };

  useEffect(() => {
    initGoogleAuth().then(async () => {
      setAuthReady(true);
      if (isSignedIn()) {
        const restored = await tryRestoreSession();
        if (restored) {
          await loadFromDrive();
          setSignedIn(true);
        }
      }
    });
  }, []);

  const handleLogin = async () => {
    await loadFromDrive();
    setSignedIn(true);
  };

  const handleLogout = () => {
    signOut();
    setSignedIn(false);
    setDataLoaded(false);
  };

  if (!authReady) return null;
  if (!signedIn) return <LoginPage onLogin={handleLogin} />;
  if (!dataLoaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111', color: '#fff' }}>
      Chargement...
    </div>
  );

  const handleImportHistorique = () => {
    saveDataToDrive(getAllData());
  };

  return <AppContent onLogout={handleLogout} onImportHistorique={handleImportHistorique} />;
}

export default App;
