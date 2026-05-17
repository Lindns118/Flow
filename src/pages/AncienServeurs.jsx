import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAncienServeurs, addAncienServeur, deleteAncienServeur, getAncienServeurEntries } from '../db';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AncienServeurs() {
  const [serveurs, setServeurs] = useState([]);
  const [entries, setEntries] = useState([]);
  const [nom, setNom] = useState('');

  const load = () => {
    setServeurs(getAncienServeurs());
    setEntries(getAncienServeurEntries());
  };

  useEffect(() => { load(); }, []);

  const handleAdd = () => {
    if (!nom.trim()) return;
    addAncienServeur(nom.trim());
    setNom('');
    load();
  };

  const handleDelete = (key) => {
    deleteAncienServeur(key);
    load();
  };

  const getTotal = (key) => {
    const e = entries.filter((e) => e.serveur_key === key);
    const negTotal = e.filter((e) => e.montant < 0).reduce((a, b) => a + b.montant, 0);
    const posTotal = e.filter((e) => e.montant > 0).reduce((a, b) => a + b.montant, 0);
    return negTotal * 0.6 + posTotal;
  };

  return (
    <div className="page-container">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Anciens Serveurs</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input-field"
            placeholder="Nom..."
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleAdd}>+</button>
        </div>
      </div>

      {serveurs.length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>Aucun ancien serveur</div>
      )}

      {serveurs.map((s) => {
        const total = getTotal(s.key);
        return (
          <div key={s.key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              to={`/ancien-serveur/${s.key}`}
              style={{ flex: 1, fontWeight: 600, fontSize: 16, color: '#1f2937' }}
            >
              {s.nom}
            </Link>
            <span style={{ fontWeight: 700, color: total < 0 ? '#dc2626' : total > 0 ? '#16a34a' : '#6b7280' }}>
              {fmt(total)} €
            </span>
            <button
              className="btn btn-danger"
              style={{ padding: '6px 10px', fontSize: 13 }}
              onClick={() => handleDelete(s.key)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
