import { useState, useEffect } from 'react';
import { getNotes, saveNotes, deleteNote } from '../db';

const fmt = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NotesClients() {
  const [notes, setNotes] = useState([]);
  const [showAnnulees, setShowAnnulees] = useState({});
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});

  const load = () => setNotes(getNotes());
  useEffect(() => { load(); }, []);

  const grouped = notes.reduce((acc, n) => {
    const key = n.destinataire_key || 'unknown';
    if (!acc[key]) acc[key] = { nom: n.destinataire_nom || key, notes: [] };
    acc[key].notes.push(n);
    return acc;
  }, {});

  const handleDelete = (id) => {
    deleteNote(id);
    load();
  };

  const startEdit = (n) => {
    setEditing(n.id);
    setEditData({ personne: n.personne, montant: n.montant, date: n.date });
  };

  const saveEdit = (id) => {
    const allNotes = getNotes();
    const idx = allNotes.findIndex((n) => n.id === id);
    if (idx >= 0) {
      allNotes[idx] = { ...allNotes[idx], ...editData, montant: parseFloat(editData.montant) };
      saveNotes(allNotes);
    }
    setEditing(null);
    load();
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 22 }}>Notes Clients</h1>
      {Object.entries(grouped).map(([key, group]) => {
        const actives = group.notes.filter((n) => !n.annulee);
        const annulees = group.notes.filter((n) => n.annulee);
        const total = actives.reduce((a, n) => a + n.montant, 0);
        return (
          <div key={key} className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 className="section-title" style={{ margin: 0 }}>{group.nom}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: total < 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{fmt(total)}</span>
                {annulees.length > 0 && (
                  <button className="outline-btn small" onClick={() => setShowAnnulees((s) => ({ ...s, [key]: !s[key] }))}>
                    {showAnnulees[key] ? 'Masquer annulées' : `Annulées (${annulees.length})`}
                  </button>
                )}
              </div>
            </div>
            {actives.map((n) => (
              <div key={n.id} className="list-row">
                {editing === n.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                    <input className="input" style={{ flex: 2 }} value={editData.personne}
                      onChange={(e) => setEditData({ ...editData, personne: e.target.value })} />
                    <input className="input" style={{ flex: 1 }} type="number" value={editData.montant}
                      onChange={(e) => setEditData({ ...editData, montant: e.target.value })} />
                    <input className="input" style={{ flex: 1 }} type="date" value={editData.date}
                      onChange={(e) => setEditData({ ...editData, date: e.target.value })} />
                    <button className="primary-btn small" onClick={() => saveEdit(n.id)}>✓</button>
                    <button className="outline-btn small" onClick={() => setEditing(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 13, flex: 1, cursor: 'pointer' }} onClick={() => startEdit(n)}>
                      {n.personne} → {group.nom} ({n.date})
                    </span>
                    <span style={{ color: n.montant < 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{fmt(n.montant)}</span>
                    <button className="delete-btn" onClick={() => handleDelete(n.id)}>🗑</button>
                  </>
                )}
              </div>
            ))}
            {showAnnulees[key] && annulees.map((n) => (
              <div key={n.id} className="list-row" style={{ opacity: 0.4 }}>
                <span style={{ fontSize: 13, flex: 1 }}>{n.personne} → {group.nom} ({n.date}) [annulée]</span>
                <span>{fmt(n.montant)}</span>
                <button className="delete-btn" onClick={() => handleDelete(n.id)}>🗑</button>
              </div>
            ))}
          </div>
        );
      })}
      {Object.keys(grouped).length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: '#9ca3af' }}>Aucune note enregistrée</div>
      )}
    </div>
  );
}
