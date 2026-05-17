import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPersonnes, deletePersonne, deletePersonneData } from '../db';

export default function Personnes() {
  const [personnes, setPersonnes] = useState([]);
  const [modal, setModal] = useState(null);

  const load = () => setPersonnes(getPersonnes());
  useEffect(() => { load(); }, []);

  const confirm = (action, label, key, nom) => {
    setModal({ action, label, key, nom });
  };

  const handleConfirm = () => {
    if (!modal) return;
    if (modal.action === 'vider') {
      deletePersonneData(modal.key);
    } else if (modal.action === 'supprimer') {
      deletePersonne(modal.key);
    }
    setModal(null);
    load();
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 22 }}>Personnes</h1>
      {personnes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: '#9ca3af' }}>Aucune personne enregistrée</div>
      )}
      {personnes.map((p) => (
        <div key={p.key} className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="icon-btn" title="Vider les fiches salaires" onClick={() => confirm('vider', 'Vider les fiches salaires', p.key, p.nom)}>
            🗑
          </button>
          <Link to={`/personne/${p.key}`} style={{ flex: 1, fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>
            {p.nom}
          </Link>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{p.key}</span>
          <button className="icon-btn danger" title="Supprimer la personne" onClick={() => confirm('supprimer', 'Supprimer la personne', p.key, p.nom)}>
            🗑
          </button>
        </div>
      ))}

      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 32, maxWidth: 400, width: '90%' }}>
            <h3 style={{ marginTop: 0 }}>{modal.label}</h3>
            <p>
              {modal.action === 'vider'
                ? `Supprimer toutes les fiches salaires de "${modal.nom}" ? La personne et ses notes clients seront conservées.`
                : `Supprimer "${modal.nom}" et toutes ses fiches salaires ? Cette action est irréversible.`}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="outline-btn" onClick={() => setModal(null)}>Annuler</button>
              <button
                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}
                onClick={handleConfirm}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
