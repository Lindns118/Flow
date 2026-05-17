import { useState, useEffect } from 'react';
import {
  getFichesPierre, addFichePierre, deleteFichePierre, updateFichePierre,
  getNotes, addNote, getPersonnes
} from '../db';
import jsPDF from 'jspdf';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

export default function Pierre() {
  const [fiches, setFiches] = useState([]);
  const [date, setDate] = useState(today());
  const [heures, setHeures] = useState('');
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [pierreDate, setPierreDate] = useState(today());
  const [pierreHeures, setPierreHeures] = useState('');
  const [notesClients, setNotesClients] = useState([]);
  const [personnesList, setPersonnesList] = useState([]);
  const [noteForm, setNoteForm] = useState({ personne: 'Pierre', montant: '', destinataire_key: '', date: today() });
  const [lastNote, setLastNote] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    setFiches(getFichesPierre().sort((a, b) => b.date.localeCompare(a.date)));
    setNotesClients(getNotes().filter((n) => n.destinataire_key === 'pierre' && !n.annulee));
    setPersonnesList(getPersonnes());
  };

  useEffect(() => { load(); }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const handleSaveFiche = () => {
    if (!heures || !date) return;
    addFichePierre({ date, heures: parseFloat(heures), notes });
    setHeures('');
    setNotes('');
    load();
    flash('✓ Fiche sauvegardée');
  };

  const handleDelete = (id) => {
    deleteFichePierre(id);
    load();
  };

  const handleEdit = (f) => {
    setEditId(f.id);
    setEditData({ date: f.date, heures: String(f.heures), notes: f.notes || '' });
  };

  const handleSaveEdit = () => {
    updateFichePierre(editId, { date: editData.date, heures: parseFloat(editData.heures), notes: editData.notes });
    setEditId(null);
    load();
    flash('✓ Modifié');
  };

  const handleSavePierreRaccourci = () => {
    if (!pierreHeures || !pierreDate) return;
    addFichePierre({ date: pierreDate, heures: parseFloat(pierreHeures), notes: '' });
    setPierreHeures('');
    load();
    flash('✓ Fiche rapide sauvegardée');
  };

  const handleSaveNote = () => {
    if (!noteForm.montant || !noteForm.destinataire_key) return;
    const dest = personnesList.find((p) => p.key === noteForm.destinataire_key);
    const note = addNote({
      personne: 'Pierre',
      montant: parseFloat(noteForm.montant),
      destinataire_key: noteForm.destinataire_key,
      destinataire_nom: dest ? dest.nom : noteForm.destinataire_key,
      date: noteForm.date || today(),
    });
    setLastNote(note);
    setNoteForm({ personne: 'Pierre', montant: '', destinataire_key: '', date: today() });
    load();
    flash('✓ Note enregistrée');
  };

  const totalNotes = notesClients.reduce((a, b) => a + b.montant, 0);
  const totalFiches = fiches.reduce((a, b) => a + b.montant, 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text('Fiches Pierre', 14, y);
    y += 10;
    doc.setFontSize(10);
    fiches.forEach((f) => {
      doc.text(`${fmtDate(f.date)}  ${f.heures}h  ${fmt(f.montant)} €  ${f.notes || ''}`, 14, y);
      y += 7;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.setFontSize(12);
    doc.text(`Total: ${fmt(totalFiches)} €`, 14, y);
    doc.save('pierre-fiches.pdf');
  };

  return (
    <div className="page-container">
      {msg && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {msg}
        </div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Pierre</h1>

      <div className="two-col">
        {/* Left column */}
        <div>
          {/* Fiches journalières */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Fiches journalières</div>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={exportPDF}>Export PDF</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <div>
                <div className="label-sm">Date</div>
                <input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <div className="label-sm">Heures</div>
                <input className="input-field" type="number" placeholder="0" value={heures} onChange={(e) => setHeures(e.target.value)} />
              </div>
              <div>
                <div className="label-sm">Notes</div>
                <input className="input-field" placeholder="Notes (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleSaveFiche} style={{ width: '100%', marginBottom: 14 }}>Enregistrer</button>

            {fiches.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune fiche</div>}
            {fiches.map((f) => (
              <div key={f.id}>
                {editId === f.id ? (
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input className="input-field" type="date" value={editData.date} onChange={(e) => setEditData({ ...editData, date: e.target.value })} />
                      <input className="input-field" type="number" value={editData.heures} onChange={(e) => setEditData({ ...editData, heures: e.target.value })} />
                      <input className="input-field" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} placeholder="Notes" />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={handleSaveEdit}>✓ Sauvegarder</button>
                      <button className="btn btn-secondary" onClick={() => setEditId(null)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="row-hover nota-row" onClick={() => handleEdit(f)} style={{ cursor: 'pointer' }}>
                    <span style={{ width: 90, color: '#6b7280', fontSize: 13 }}>{fmtDate(f.date)}</span>
                    <span style={{ width: 60 }}>{f.heures}h</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{fmt(f.montant)} €</span>
                    {f.notes && <span style={{ color: '#9ca3af', fontSize: 12, flex: 1 }}>{f.notes}</span>}
                    <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}>✕</button>
                  </div>
                )}
              </div>
            ))}
            {fiches.length > 0 && (
              <div style={{ marginTop: 10, fontWeight: 700, color: '#2563eb' }}>
                Total : {fmt(totalFiches)} €
              </div>
            )}
          </div>

          {/* Salaire raccourci */}
          <div className="card">
            <div className="card-title">Salaire Pierre (raccourci)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 36px', gap: 8, alignItems: 'end' }}>
              <div>
                <div className="label-sm">Date</div>
                <input className="input-field" type="date" value={pierreDate} onChange={(e) => setPierreDate(e.target.value)} />
              </div>
              <div>
                <div className="label-sm">Heures</div>
                <input className="input-field" type="number" placeholder="0" value={pierreHeures} onChange={(e) => setPierreHeures(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ padding: '8px 6px' }} onClick={handleSavePierreRaccourci}>💾</button>
            </div>
            {pierreHeures && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                {pierreHeures}h × 10 = <strong>{fmt(parseFloat(pierreHeures) * 10)} €</strong>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Feuille client */}
          <div className="card">
            <div className="card-title">Feuille client</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>
              <div>
                <div className="label-sm">Pour qui</div>
                <select className="input-field" value={noteForm.destinataire_key} onChange={(e) => setNoteForm({ ...noteForm, destinataire_key: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {personnesList.map((p) => (
                    <option key={p.key} value={p.key}>{p.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="label-sm">Montant</div>
                <input className="input-field" type="number" placeholder="±0" value={noteForm.montant} onChange={(e) => setNoteForm({ ...noteForm, montant: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div className="label-sm">Date</div>
              <input className="input-field" type="date" value={noteForm.date} onChange={(e) => setNoteForm({ ...noteForm, date: e.target.value })} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveNote}>Enregistrer la note</button>

            {lastNote && (
              <div style={{ marginTop: 12, background: '#f0f9ff', padding: '10px', borderRadius: 8, fontSize: 13 }}>
                <div className="label-sm" style={{ marginBottom: 4 }}>Dernière note</div>
                <div>Pierre → {lastNote.destinataire_nom} : <strong style={{ color: lastNote.montant < 0 ? '#dc2626' : '#16a34a' }}>{fmt(lastNote.montant)} €</strong></div>
              </div>
            )}
          </div>

          {/* Notes clients reçues */}
          <div className="card">
            <div className="card-title">Notes clients reçues</div>
            <div className="blue-total" style={{ marginBottom: 14 }}>Total : {fmt(totalNotes)} €</div>
            {notesClients.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune note</div>}
            {notesClients.map((n) => (
              <div key={n.id} className="nota-row">
                <span style={{ flex: 1, fontSize: 13 }}>
                  {n.personne} → Pierre ({n.date ? n.date.substring(5, 7) + '/' + n.date.substring(2, 4) : ''})
                </span>
                <span style={{ fontWeight: 600, color: n.montant < 0 ? '#dc2626' : '#16a34a' }}>{fmt(n.montant)} €</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
