import { useState, useEffect } from 'react';
import { getNotes, saveNotes, deleteNote } from '../db';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

export default function NotesClients() {
  const [notes, setNotes] = useState([]);
  const [showAnnulees, setShowAnnulees] = useState({});
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [triPar, setTriPar] = useState('serveur'); // 'serveur' | 'client'

  const load = () => setNotes(getNotes());
  useEffect(() => { load(); }, []);

  // Groupement selon le tri choisi
  const grouped = notes.reduce((acc, n) => {
    const key = triPar === 'serveur'
      ? (n.destinataire_key || 'inconnu')
      : (n.personne?.toLowerCase().replace(/\s+/g, '_') || 'inconnu');
    const label = triPar === 'serveur'
      ? (n.destinataire_nom || n.destinataire_key || '?')
      : (n.personne || '?');
    if (!acc[key]) acc[key] = { nom: label, notes: [] };
    acc[key].notes.push(n);
    return acc;
  }, {});

  // Tri alphabétique des groupes
  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) =>
    a.nom.localeCompare(b.nom, 'fr')
  );

  const handleDelete = (id) => { deleteNote(id); load(); };

  const handleEdit = (n) => {
    setEditId(n.id);
    setEditData({ personne: n.personne, montant: String(n.montant), date: n.date });
  };

  const handleSaveEdit = () => {
    const allNotes = getNotes();
    const note = allNotes.find((n) => n.id === editId);
    if (note) {
      note.personne = editData.personne;
      note.montant = parseFloat(editData.montant);
      note.date = editData.date;
      saveNotes(allNotes);
    }
    setEditId(null);
    load();
  };

  const toggleAnnulees = (key) => setShowAnnulees((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Notes clients</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={triPar === 'serveur' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setTriPar('serveur')}
          >
            Par serveur
          </button>
          <button
            className={triPar === 'client' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setTriPar('client')}
          >
            Par client
          </button>
        </div>
      </div>

      {sortedGroups.length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>Aucune note enregistrée</div>
      )}

      {sortedGroups.map(([key, group]) => {
        const activeNotes = group.notes.filter((n) => !n.annulee);
        const annuleesNotes = group.notes.filter((n) => n.annulee);
        const total = activeNotes.reduce((a, b) => a + b.montant, 0);
        const showAnn = showAnnulees[key];

        // Tri interne par date
        const sorted = (arr) => [...arr].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const renderNote = (n) => (
          <div key={n.id}>
            {editId === n.id ? (
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px', gap: 8, marginBottom: 8 }}>
                  <input className="input-field" value={editData.personne}
                    onChange={(e) => setEditData({ ...editData, personne: e.target.value })} placeholder="Personne" />
                  <input className="input-field" type="number" value={editData.montant}
                    onChange={(e) => setEditData({ ...editData, montant: e.target.value })} />
                  <input className="input-field" type="date" value={editData.date}
                    onChange={(e) => setEditData({ ...editData, date: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleSaveEdit}>✓</button>
                  <button className="btn btn-secondary" onClick={() => setEditId(null)}>Annuler</button>
                </div>
              </div>
            ) : (
              <div className="nota-row" style={{ cursor: 'pointer' }} onClick={() => handleEdit(n)}>
                <span style={{ flex: 1, fontSize: 13 }}>
                  {triPar === 'serveur'
                    ? <>{n.personne} <span style={{ color: '#9ca3af' }}>→ {group.nom}</span></>
                    : <>{group.nom} <span style={{ color: '#9ca3af' }}>→ {n.destinataire_nom}</span></>
                  }
                  {' '}({fmtDate(n.date)})
                </span>
                <span style={{ fontWeight: 600, color: n.montant < 0 ? '#dc2626' : '#16a34a' }}>
                  {fmt(n.montant)} €
                </span>
                <button
                  className="btn btn-danger"
                  style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                >✕</button>
              </div>
            )}
          </div>
        );

        return (
          <div key={key} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>{group.nom}</div>
                <div style={{ fontWeight: 700, color: total <= 0 ? '#dc2626' : '#16a34a', fontSize: 15 }}>
                  {fmt(total)} €
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {annuleesNotes.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => toggleAnnulees(key)}
                  >
                    {showAnn ? 'Masquer annulées' : `Annulées (${annuleesNotes.length})`}
                  </button>
                )}
              </div>
            </div>

            {activeNotes.length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune note active</div>
            )}

            {sorted(activeNotes).map(renderNote)}

            {showAnn && annuleesNotes.length > 0 && (
              <div style={{ borderTop: '1px dashed #e5e7eb', marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 6, fontWeight: 600 }}>ANNULÉES</div>
                {sorted(annuleesNotes).map((n) => (
                  <div key={n.id} className="nota-row" style={{ opacity: 0.5 }}>
                    <span style={{ flex: 1, fontSize: 13 }}>
                      {n.personne} → {n.destinataire_nom} ({fmtDate(n.date)})
                    </span>
                    <span style={{ fontWeight: 600, color: n.montant < 0 ? '#dc2626' : '#16a34a' }}>
                      {fmt(n.montant)} €
                    </span>
                    <button
                      className="btn btn-danger"
                      style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
