import { useState, useEffect } from 'react';
import {
  getFichesPierre, addFichePierre, deleteFichePierre, updateFichePierre, deleteFichesPierreMois,
  getNotes, addNote, getPersonnes, resetPierre
} from '../db';
import jsPDF from 'jspdf';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';
const fmtMois = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${names[parseInt(mo, 10) - 1]} ${y}`;
};

export default function Pierre() {
  const [fiches, setFiches] = useState([]);
  const [selectedMois, setSelectedMois] = useState(null);
  const [ficheType, setFicheType] = useState('salaire');
  const [date, setDate] = useState(today());
  const [heures, setHeures] = useState('');
  const [montantRetrait, setMontantRetrait] = useState('');
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [notesClients, setNotesClients] = useState([]);
  const [personnesList, setPersonnesList] = useState([]);
  const [noteForm, setNoteForm] = useState({ personne: 'Pierre', montant: '', destinataire_key: '', date: today() });
  const [lastNote, setLastNote] = useState(null);
  const [msg, setMsg] = useState('');
  const [confirmDeleteMois, setConfirmDeleteMois] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = () => {
    const all = getFichesPierre().sort((a, b) => b.date.localeCompare(a.date));
    setFiches(all);
    setNotesClients(getNotes().filter((n) => n.destinataire_key === 'pierre' && !n.annulee));
    setPersonnesList(getPersonnes());
    // Auto-select current month if nothing selected
    setSelectedMois((prev) => {
      if (prev) return prev;
      const curMois = today().substring(0, 7);
      return all.some((f) => f.mois === curMois) ? curMois : (all[0]?.mois || curMois);
    });
  };

  useEffect(() => { load(); }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const handleReset = () => {
    resetPierre();
    setConfirmReset(false);
    setSelectedMois(null);
    load();
    flash('✓ Pierre réinitialisé');
  };

  // Group by month
  const moisMap = fiches.reduce((acc, f) => {
    const m = f.mois || f.date.substring(0, 7);
    if (!acc[m]) acc[m] = { total: 0, fiches: [] };
    acc[m].total += f.montant;
    acc[m].fiches.push(f);
    return acc;
  }, {});
  const moisList = Object.keys(moisMap).sort((a, b) => b.localeCompare(a));

  const fichesOfMois = selectedMois ? (moisMap[selectedMois]?.fiches || []) : [];

  const handleSaveFiche = () => {
    if (!date) return;
    if (ficheType === 'salaire' && !heures) return;
    if (ficheType === 'retrait' && !montantRetrait) return;
    addFichePierre({ date, heures: parseFloat(heures) || 0, montantDirect: parseFloat(montantRetrait) || 0, notes, type: ficheType });
    setHeures('');
    setMontantRetrait('');
    setNotes('');
    setSelectedMois(date.substring(0, 7));
    load();
    flash('✓ Fiche sauvegardée');
  };

  const handleDelete = (id) => {
    deleteFichePierre(id);
    load();
  };

  const handleDeleteMois = (mois) => {
    deleteFichesPierreMois(mois);
    setConfirmDeleteMois(null);
    setSelectedMois(null);
    load();
    flash(`✓ Mois ${fmtMois(mois)} supprimé`);
  };

  const handleEdit = (f) => {
    setEditId(f.id);
    setEditData({
      date: f.date,
      heures: String(f.heures || ''),
      montantDirect: String(f.type === 'retrait' ? f.montant : ''),
      notes: f.notes || '',
      type: f.type || 'salaire',
    });
  };

  const handleSaveEdit = () => {
    updateFichePierre(editId, {
      date: editData.date,
      heures: parseFloat(editData.heures) || 0,
      montantDirect: parseFloat(editData.montantDirect) || 0,
      notes: editData.notes,
      type: editData.type,
    });
    setEditId(null);
    load();
    flash('✓ Modifié');
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
      {confirmReset && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Réinitialiser Pierre</h3>
            <p>Toutes les fiches de Pierre seront supprimées. Les notes resteront visibles dans Notes Clients.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>Annuler</button>
              <button className="btn btn-danger" onClick={handleReset}>Réinitialiser</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteMois && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Supprimer {fmtMois(confirmDeleteMois)}</h3>
            <p>Toutes les fiches de ce mois seront supprimées définitivement.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteMois(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => handleDeleteMois(confirmDeleteMois)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Pierre</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setConfirmReset(true)}>Réinitialiser</button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={exportPDF}>Export PDF</button>
        </div>
      </div>

      {/* Onglets mois */}
      {moisList.length > 0 && (
        <div className="card" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Fiches par mois</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            {moisList.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMois(m)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 600,
                  border: selectedMois === m ? 'none' : '1px solid #d1d5db',
                  background: selectedMois === m ? '#2563eb' : '#f9fafb',
                  color: selectedMois === m ? '#fff' : '#374151',
                }}
              >
                {fmtMois(m)}
                <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.8 }}>{fmt(moisMap[m].total)} €</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fiches du mois sélectionné */}
      {selectedMois && (
        <div className="card" style={{ borderTopLeftRadius: moisList.length > 0 ? 0 : undefined, borderTopRightRadius: moisList.length > 0 ? 0 : undefined, borderTop: moisList.length > 0 ? '1px solid #e5e7eb' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: '#1f2937' }}>{fmtMois(selectedMois)}</div>
            {moisMap[selectedMois] && (
              <button
                className="btn btn-danger"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setConfirmDeleteMois(selectedMois)}
              >
                Supprimer le mois
              </button>
            )}
          </div>

          {fichesOfMois.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune fiche ce mois</div>}

          {[...fichesOfMois].sort((a, b) => b.date.localeCompare(a.date)).map((f) => (
            <div key={f.id}>
              {editId === f.id ? (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {['salaire', 'retrait'].map((t) => (
                      <button key={t}
                        className={editData.type === t ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setEditData({ ...editData, type: t })}
                      >{t === 'salaire' ? 'Salaire' : 'Retrait'}</button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input className="input-field" type="date" value={editData.date} onChange={(e) => setEditData({ ...editData, date: e.target.value })} />
                    {editData.type === 'retrait'
                      ? <input className="input-field" type="number" placeholder="Montant" value={editData.montantDirect} onChange={(e) => setEditData({ ...editData, montantDirect: e.target.value })} />
                      : <input className="input-field" type="number" placeholder="Heures" value={editData.heures} onChange={(e) => setEditData({ ...editData, heures: e.target.value })} />
                    }
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
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, marginRight: 6,
                    background: f.type === 'retrait' ? '#fef2f2' : '#eff6ff',
                    color: f.type === 'retrait' ? '#dc2626' : '#2563eb',
                  }}>{f.type === 'retrait' ? 'Retrait' : 'Salaire'}</span>
                  {f.type === 'salaire' && <span style={{ width: 50 }}>{f.heures}h</span>}
                  <span style={{ flex: 1, fontWeight: 600, color: f.type === 'retrait' ? '#dc2626' : undefined }}>{fmt(f.montant)} €</span>
                  {f.notes && <span style={{ color: '#9ca3af', fontSize: 12, flex: 1 }}>{f.notes}</span>}
                  <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}>✕</button>
                </div>
              )}
            </div>
          ))}

          {fichesOfMois.length > 0 && (
            <div style={{ marginTop: 10, fontWeight: 700, color: '#2563eb' }}>
              Total {fmtMois(selectedMois)} : {fmt(moisMap[selectedMois]?.total || 0)} €
            </div>
          )}
        </div>
      )}

      <div className="two-col">
        {/* Nouvelle fiche */}
        <div className="card">
          <div className="card-title">Nouvelle fiche</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['salaire', 'retrait'].map((t) => (
              <button key={t}
                className={ficheType === t ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: 13, padding: '6px 16px' }}
                onClick={() => setFicheType(t)}
              >{t === 'salaire' ? 'Salaire' : 'Retrait'}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'end' }}>
            <div>
              <div className="label-sm">Date</div>
              <input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <div className="label-sm">{ficheType === 'retrait' ? 'Montant' : 'Heures'}</div>
              {ficheType === 'retrait'
                ? <input className="input-field" type="number" placeholder="0" value={montantRetrait} onChange={(e) => setMontantRetrait(e.target.value)} />
                : <input className="input-field" type="number" placeholder="0" value={heures} onChange={(e) => setHeures(e.target.value)} />
              }
            </div>
            <div>
              <div className="label-sm">Notes</div>
              <input className="input-field" placeholder="Notes (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {ficheType === 'salaire' && heures && (
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{heures}h × 10 = <strong>{fmt(parseFloat(heures) * 10)} €</strong></div>
          )}
          <button className="btn btn-primary" onClick={handleSaveFiche} style={{ width: '100%' }}>Enregistrer</button>
          {fiches.length > 0 && (
            <div style={{ marginTop: 10, fontWeight: 700, color: '#2563eb' }}>
              Total général : {fmt(totalFiches)} €
            </div>
          )}
        </div>

        {/* Notes clients */}
        <div>
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
