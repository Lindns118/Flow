import { useState, useEffect } from 'react';
import { getFichesPierre, addFichePierre, deleteFichePierre, updateFichePierre, addNote, getNotes, getPersonnes } from '../db';
import jsPDF from 'jspdf';

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Pierre() {
  const [fiches, setFiches] = useState([]);
  const [date, setDate] = useState(today());
  const [heures, setHeures] = useState('');
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [notesRecues, setNotesRecues] = useState([]);
  const [personnes, setPersonnes] = useState([]);
  const [noteForm, setNoteForm] = useState({ personne: 'Pierre', montant: '', destinataire: '', date: today() });
  const [salDate, setSalDate] = useState(today());
  const [salHeures, setSalHeures] = useState('');

  const load = () => {
    setFiches(getFichesPierre().sort((a, b) => b.date.localeCompare(a.date)));
    setNotesRecues(getNotes().filter((n) => n.destinataire_key === 'pierre' && !n.annulee));
    setPersonnes(getPersonnes());
  };

  useEffect(() => { load(); }, []);

  const handleSaveFiche = () => {
    if (!heures) return;
    addFichePierre({ date, heures: parseFloat(heures), notes });
    setHeures('');
    setNotes('');
    load();
  };

  const handleSaveSalaire = () => {
    if (!salHeures) return;
    addFichePierre({ date: salDate, heures: parseFloat(salHeures), notes: '' });
    setSalHeures('');
    load();
  };

  const handleDelete = (id) => {
    deleteFichePierre(id);
    load();
  };

  const startEdit = (f) => {
    setEditId(f.id);
    setEditData({ date: f.date, heures: f.heures, notes: f.notes });
  };

  const saveEdit = () => {
    updateFichePierre(editId, editData);
    setEditId(null);
    load();
  };

  const handleSaveNote = () => {
    if (!noteForm.montant || !noteForm.destinataire) return;
    const dest = noteForm.destinataire === 'pierre'
      ? { key: 'pierre', nom: 'Pierre' }
      : personnes.find((p) => p.key === noteForm.destinataire) || { key: noteForm.destinataire, nom: noteForm.destinataire };
    addNote({
      personne: noteForm.personne || 'Pierre',
      montant: parseFloat(noteForm.montant),
      destinataire_key: dest.key,
      destinataire_nom: dest.nom,
      date: noteForm.date,
    });
    setNoteForm({ personne: 'Pierre', montant: '', destinataire: '', date: today() });
    load();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text('Fiches Pierre', 14, y); y += 12;
    doc.setFontSize(10);
    fiches.forEach((f) => {
      doc.text(`${f.date}  ${f.heures}h  ${fmt(f.montant)}  ${f.notes || ''}`, 14, y); y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    const total = fiches.reduce((a, f) => a + f.montant, 0);
    doc.setFontSize(12);
    doc.text(`Total: ${fmt(total)}`, 14, y);
    doc.save('fiches_pierre.pdf');
  };

  const total = fiches.reduce((a, f) => a + f.montant, 0);
  const totalNotesRecues = notesRecues.reduce((a, n) => a + n.montant, 0);

  const destOptions = [
    { key: 'pierre', nom: 'Pierre (lui-même)' },
    ...personnes,
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 22 }}>⭐ Pierre — 10€/heure</h1>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Left column */}
        <div style={{ flex: '1 1 400px' }}>
          {/* Fiches journalières */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="section-title">FICHES JOURNALIÈRES</h2>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="label">DATE</div>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">HEURES</div>
                <input className="input" type="number" placeholder="0" value={heures} onChange={(e) => setHeures(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="label">NOTES</div>
              <textarea className="input" rows={2} placeholder="Notes optionnelles" value={notes}
                onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <button className="primary-btn" onClick={handleSaveFiche}>Enregistrer la fiche</button>
            <button className="outline-btn" style={{ marginLeft: 8 }} onClick={exportPDF}>Export PDF</button>

            <div style={{ marginTop: 16 }}>
              {fiches.map((f) => (
                <div key={f.id} className="list-row" style={{ cursor: 'pointer' }}
                  onClick={() => editId !== f.id && startEdit(f)}>
                  {editId === f.id ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <input className="input" type="date" value={editData.date}
                          onChange={(e) => setEditData({ ...editData, date: e.target.value })} />
                        <input className="input" type="number" value={editData.heures}
                          onChange={(e) => setEditData({ ...editData, heures: e.target.value })} />
                      </div>
                      <input className="input" placeholder="Notes" value={editData.notes}
                        onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
                      <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                        <button className="primary-btn small" onClick={saveEdit}>Enregistrer</button>
                        <button className="outline-btn small" onClick={() => setEditId(null)}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, flex: 1 }}>{f.date} — {f.heures}h</span>
                      <span style={{ color: '#2563EB', fontWeight: 600 }}>{fmt(f.montant)}</span>
                      {f.notes && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{f.notes}</span>}
                      <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}>✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="total-small">Total: <strong>{fmt(total)}</strong></div>
          </div>

          {/* Salaire raccourci */}
          <div className="card">
            <h2 className="section-title">SALAIRE PIERRE (RACCOURCI)</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="label">DATE</div>
                <input className="input" type="date" value={salDate} onChange={(e) => setSalDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">HEURES</div>
                <input className="input" type="number" placeholder="0" value={salHeures}
                  onChange={(e) => setSalHeures(e.target.value)} />
              </div>
              <button className="save-btn" style={{ marginTop: 20 }} onClick={handleSaveSalaire}>💾</button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: '1 1 340px' }}>
          {/* Feuille client */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="section-title">FEUILLE CLIENT</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 2 }}>
                <div className="label">DE (PERSONNE)</div>
                <input className="input" value={noteForm.personne}
                  onChange={(e) => setNoteForm({ ...noteForm, personne: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">MONTANT</div>
                <input className="input" type="number" placeholder="±0" value={noteForm.montant}
                  onChange={(e) => setNoteForm({ ...noteForm, montant: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div className="label">POUR QUI</div>
                <select className="input" value={noteForm.destinataire}
                  onChange={(e) => setNoteForm({ ...noteForm, destinataire: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {destOptions.map((d) => (
                    <option key={d.key} value={d.key}>{d.nom}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">DATE</div>
                <input className="input" type="date" value={noteForm.date}
                  onChange={(e) => setNoteForm({ ...noteForm, date: e.target.value })} />
              </div>
            </div>
            <button className="primary-btn" onClick={handleSaveNote}>Enregistrer la note</button>
          </div>

          {/* Notes reçues */}
          <div className="card">
            <h2 className="section-title">NOTES CLIENTS REÇUES</h2>
            <div className="total-bar" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>TOTAL</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(totalNotesRecues)}</div>
            </div>
            {notesRecues.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>Aucune note</p>}
            {notesRecues.map((n) => (
              <div key={n.id} className="list-row">
                <span style={{ fontSize: 13 }}>{n.personne} → Pierre ({n.date})</span>
                <span style={{ color: n.montant < 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{fmt(n.montant)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
