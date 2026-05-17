import { useState, useEffect } from 'react';
import { getNotes, saveNotes, deleteNote } from '../db';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

export default function NotesClients() {
  const [notes, setNotes] = useState([]);
  const [showAnnulees, setShowAnnulees] = useState({});
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  const load = () => setNotes(getNotes());
  useEffect(() => { load(); }, []);

  const grouped = notes.reduce((acc, n) => {
    const key = n.destinataire_key || 'inconnu';
    if (!acc[key]) acc[key] = { nom: n.destinataire_nom || key, notes: [] };
    acc[key].notes.push(n);
    return acc;
  }, {});

  const handleDelete = (id) => {
    deleteNote(id);
    load();
  };

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

  const toggleAnnulees = (key) => {
    setShowAnnulees((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="page-container">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Notes clients</h1>

      {Object.entries(grouped).length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>Aucune note enregistrée</div>
      )}

      {Object.entries(grouped).map(([key, group]) => {
        const activeNotes = group.notes.filter((n) => !n.annulee);
        const annuleesNotes = group.notes.filter((n) => n.annulee);
        const total = activeNotes.reduce((a, b) => a + b.montant, 0);
        const show = showAnnulees[key];

        return (
          <div key={key} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>{group.nom}</div>
                <div style={{ fontWeight: 700, color: total >= 0 ? '#16a34a' : '#dc2626', fontSize: 15 }}>
                  {fmt(total)} €
                </div>
              </div>
              {annuleesNotes.length > 0 && (
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => toggleAnnulees(key)}>
                  {show ? 'Masquer annulées' : `Voir annulées (${annuleesNotes.length})`}
                </button>
              )}
            </div>

            {activeNotes.length === 0 && !show && (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune note active</div>
            )}

            {activeNotes.map((n) => (
              <div key={n.id}>
                {editId === n.id ? (
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px', gap: 8, marginBottom: 8 }}>
                      <input className="input-field" value={editData.personne} onChange={(e) => setEditData({ ...editData, personne: e.target.value })} placeholder="Personne" />
                      <input className="input-field" type="number" value={editData.montant} onChange={(e) => setEditData({ ...editData, montant: e.target.value })} />
                      <input className="input-field" type="date" value={editData.date} onChange={(e) => setEditData({ ...editData, date: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={handleSaveEdit}>✓</button>
                      <button className="btn btn-secondary" onClick={() => setEditId(null)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="nota-row" style={{ cursor: 'pointer' }} onClick={() => handleEdit(n)}>
                    <span style={{ flex: 1, fontSize: 13 }}>
                      {n.personne} → {group.nom} ({n.date ? n.date.substring(5, 7) + '/' + n.date.substring(2, 4) : ''})
                    </span>
                    <span style={{ fontWeight: 600, color: n.montant < 0 ? '#dc2626' : '#16a34a' }}>{fmt(n.montant)} €</span>
                    <button className="btn btn-danger" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}>✕</button>
                  </div>
                )}
              </div>
            ))}

            {show && annuleesNotes.map((n) => (
              <div key={n.id} className="nota-row" style={{ opacity: 0.5 }}>
                <span style={{ marginRight: 8, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>ANNULÉE</span>
                <span style={{ flex: 1, fontSize: 13 }}>
                  {n.personne} → {group.nom} ({n.date ? n.date.substring(5, 7) + '/' + n.date.substring(2, 4) : ''})
                </span>
                <span style={{ fontWeight: 600, color: n.montant < 0 ? '#dc2626' : '#16a34a' }}>{fmt(n.montant)} €</span>
                <button className="btn btn-danger" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}>✕</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
