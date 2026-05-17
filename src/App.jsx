import { useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './index.css';
import Calculator from './pages/Calculator';
import Personne from './pages/Personne';
import Pierre from './pages/Pierre';
import NotesClients from './pages/NotesClients';
import Personnes from './pages/Personnes';
import { getPersonnes } from './db';

function Navbar() {
  const [showPanel, setShowPanel] = useState(false);
  const [personnes, setPersonnes] = useState([]);
  const clickCountRef = useRef(0);
  const timerRef = useRef(null);
  const navigate = useNavigate();

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
    <div className="navbar" style={{ position: 'relative' }}>
      <span className="navbar-title" onClick={handleTitleClick}>
        SALAIRES &amp; NOTES CLIENTS
      </span>
      {showPanel && (
        <div className="hidden-panel">
          <Link to="/pierre" onClick={() => setShowPanel(false)}>⭐ Pierre</Link>
          {personnes.map((p) => (
            <Link key={p.key} to={`/personne/${p.key}`} onClick={() => setShowPanel(false)}>
              {p.nom}
            </Link>
          ))}
          <span onClick={handlePersonnesIconClick}>👥 Notes clients</span>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />
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

export default App;
