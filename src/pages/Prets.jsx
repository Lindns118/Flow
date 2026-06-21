import { useState, useEffect } from 'react';
import { getPrets, togglePretClos, deletePret } from '../db';

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

export default function Prets() {
  const [prets, setPrets] = useState([]);
  const [showClos, setShowClos] = useState(false);
  const [pendingClos, setPendingClos] = useState(null); // { id, label }
  const [dateClos, setDateClos] = useState(today());

  const load = () => setPrets(getPrets());
  useEffect(() => { load(); }, []);

  const actifs = prets.filter((p) => !p.clos);
  const clos = prets.filter((p) => p.clos);

  const emprunts = actifs.filter((p) => p.type === 'emprunt');
  const pretsList = actifs.filter((p) => p.type === 'pret');

  const empruntsC = clos.filter((p) => p.type === 'emprunt');
  const pretsC = clos.filter((p) => p.type === 'pret');

  const sorted = (arr) => [...arr].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const handleClos = (id, label) => {
    setPendingClos({ id, label });
    setDateClos(today());
  };

  const confirmClos = () => {
    togglePretClos(pendingClos.id, dateClos);
    setPendingClos(null);
    load();
  };

  const renderRow = (p) => (
    <div key={p.id}>
      <div className="nota-row" style={{ opacity: p.clos ? 0.5 : 1 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600 }}>{p.produit}</span>
          {p.nombre > 1 && <span style={{ color: '#6b7280', marginLeft: 6 }}>× {p.nombre}</span>}
          <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>{p.lieu}</span>
          <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>{fmtDate(p.date)}</span>
          {p.clos && p.dateClos && (
            <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>→ rendu {fmtDate(p.dateClos)}</span>
          )}
        </div>
        {!p.clos && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '3px 10px', marginLeft: 8 }}
            onClick={() => handleClos(p.id, p.type === 'emprunt' ? 'Rendu' : 'Récupéré')}
          >
            {p.type === 'emprunt' ? 'Rendu' : 'Récupéré'}
          </button>
        )}
        <button
          className="btn btn-danger"
          style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
          onClick={() => { deletePret(p.id); load(); }}
        >✕</button>
      </div>
      {pendingClos?.id === p.id && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 8px 4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#374151' }}>Date de {pendingClos.label.toLowerCase()} :</span>
          <input
            className="input-field"
            type="date"
            value={dateClos}
            onChange={(e) => setDateClos(e.target.value)}
            style={{ width: 150 }}
            autoFocus
          />
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={confirmClos}>
            ✓ Confirmer
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setPendingClos(null)}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );

  const Section = ({ title, items, color }) => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0, color }}>{title}</div>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{items.length} actif{items.length !== 1 ? 's' : ''}</span>
      </div>
      {items.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucun</div>}
      {sorted(items).map((p) => renderRow(p))}
    </div>
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Prêts & Emprunts</h1>
        <button
          className={showClos ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: 13, padding: '6px 14px' }}
          onClick={() => setShowClos((v) => !v)}
        >
          {showClos ? 'Masquer clôturés' : `Clôturés (${clos.length})`}
        </button>
      </div>

      <Section title="Emprunts (je dois rendre)" items={emprunts} color="#dc2626" />
      <Section title="Prêts (on me doit rendre)" items={pretsList} color="#16a34a" />

      {showClos && clos.length > 0 && (
        <div className="card" style={{ borderTop: '2px dashed #e5e7eb' }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Clôturés</div>
          {empruntsC.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 6 }}>RENDUS</div>
              {sorted(empruntsC).map((p) => renderRow(p))}
            </>
          )}
          {pretsC.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, margin: '10px 0 6px' }}>RÉCUPÉRÉS</div>
              {sorted(pretsC).map((p) => renderRow(p))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
