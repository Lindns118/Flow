import { useState, useEffect } from 'react';
import {
  getFichesPierre, addFichePierre, deleteFichePierre, updateFichePierre, deleteFichesPierreMois,
  getNotes, addNote, getPersonnes, resetPierre, getHiddenNotes, getDette, annulerRemboursement,
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
  const [bkInput, setBkInput] = useState('');
  const [dette, setDette] = useState(0);

  const load = () => {
    const all = getFichesPierre().sort((a, b) => b.date.localeCompare(a.date));
    setFiches(all);
    const rembIds = new Set(all.filter((f) => f.type === 'remboursement_note').map((f) => f.noteId).filter(Boolean));
    const hidden = getHiddenNotes();
    setNotesClients(getNotes().filter((n) => n.destinataire_key === 'pierre' && !n.annulee && !hidden.includes(n.id) && !rembIds.has(n.id)));
    setPersonnesList(getPersonnes());
    setDette(getDette('pierre'));
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

  const fichesActives = fiches.filter((f) => f.type !== 'bk' && f.type !== 'remboursement_note');
  const rembFiches = fiches.filter((f) => f.type === 'remboursement_note');
  const rembNoteIds = new Set(rembFiches.map((f) => f.noteId).filter(Boolean));
  const bkFiches = fiches.filter((f) => f.type === 'bk');

  // Group by month (exclude bk entries — they're shown in their own section)
  const moisMap = fichesActives.reduce((acc, f) => {
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
      montantDirect: String(f.type === 'retrait' ? Math.abs(f.montant) : ''),
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

  const handleAddBk = () => {
    if (!bkInput) return;
    addFichePierre({ date: new Date().toISOString().slice(0, 10), montantDirect: parseFloat(bkInput), type: 'bk' });
    setBkInput('');
    load();
  };

  const totalFiches = fichesActives.reduce((a, b) => a + b.montant, 0);
  const totalBk = bkFiches.reduce((a, b) => a + b.montant, 0);
  const totalNotes = notesClients.reduce((a, b) => a + b.montant, 0);
  const totalRemb = rembFiches.reduce((a, b) => a + Math.abs(b.montant), 0);
  const totalGeneral = totalFiches + totalNotes + totalRemb - totalBk + dette;

  const handlePrint = () => {
    const row = (cells, cls = '') => `<tr class="${cls}">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    const rowH = (cells) => `<tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr>`;

    const fichesRows = [...fichesActives].sort((a, b) => b.date.localeCompare(a.date))
      .map((f) => row([fmtDate(f.date), f.type === 'retrait' ? 'Retrait' : 'Salaire', f.type === 'salaire' ? f.heures + 'h' : '', fmt(f.montant) + ' €'])).join('');
    const noteRows = notesClients.map((n) => row([n.personne || '', fmtDate(n.date), fmt(n.montant) + ' €'])).join('');
    const rembRows = rembFiches.map((f) => row([f.notePersonne || '', fmtDate(f.noteDate || f.date), '+' + fmt(Math.abs(f.montant)) + ' €'])).join('');

    const bkSection = bkFiches.length ? `
      <h3 class="bk-titre">BK (déduit du total)</h3>
      <table><thead>${rowH(['Date', 'Montant'])}</thead><tbody>
        ${bkFiches.map((f) => row([fmtDate(f.date), fmt(f.montant) + ' €'])).join('')}
        ${row(['Total BK', fmt(totalBk) + ' €'], 'total-row')}
      </tbody></table>` : '';

    const formula = `${fmt(totalFiches)} (fiches) + ${fmt(totalNotes)} (notes) + ${fmt(totalRemb)} (remb.) − ${fmt(totalBk)} (BK)${dette !== 0 ? ` + ${fmt(dette)} (report)` : ''} = ${fmt(totalGeneral)} €`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pierre</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:9pt;padding:12mm;color:#000}
  h1{font-size:13pt;margin-bottom:6px}
  .dette{color:#dc2626;font-weight:700;margin-bottom:8px}
  .deux-cols{display:flex;gap:14px;margin-bottom:12px;align-items:flex-start}
  .col{flex:1}
  .col-titre{font-size:8pt;font-weight:700;margin-bottom:3px}
  table{border-collapse:collapse;width:100%;margin-bottom:6px}
  td,th{border:1px solid #555;padding:2px 5px;font-size:8pt}
  th{background:#f0f0f0;font-weight:700;text-align:left}
  .total-row td{font-weight:700}
  .remb-titre td{color:#2563eb;font-weight:700;background:#eff6ff}
  .bk-titre{color:#ea580c;font-size:9pt;font-weight:700;margin:10px 0 3px}
  .grand-total{font-size:13pt;font-weight:700;margin-top:12px}
  .formule{font-size:7.5pt;color:#555;margin-top:3px}
  @media print{@page{size:A4 portrait;margin:10mm}body{padding:0}}
</style></head><body>
<h1>Pierre</h1>
${dette < 0 ? `<p class="dette">Report période précédente : ${fmt(dette)} €</p>` : ''}
<div class="deux-cols">
  <div class="col">
    <div class="col-titre">Fiches</div>
    <table><thead>${rowH(['Date', 'Type', 'H', 'Montant'])}</thead><tbody>
      ${fichesRows}
      ${row(['Total', '', '', fmt(totalFiches) + ' €'], 'total-row')}
    </tbody></table>
  </div>
  <div class="col">
    <div class="col-titre">Notes clients reçues</div>
    <table><thead>${rowH(['Client', 'Date', 'Montant'])}</thead><tbody>
      ${noteRows}
      ${notesClients.length ? row(['Total notes', '', fmt(totalNotes) + ' €'], 'total-row') : ''}
      ${rembFiches.length ? `<tr class="remb-titre"><td colspan="3">Notes remboursées</td></tr>${rembRows}${row(['Total remb.', '', '+' + fmt(totalRemb) + ' €'], 'total-row')}` : ''}
    </tbody></table>
  </div>
</div>
${bkSection}
<p class="grand-total">Total Général : ${fmt(totalGeneral)} €</p>
<p class="formule">${formula}</p>
<script>window.onload=()=>window.print();</script>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 12;
    const rowH = 7;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Pierre', margin, 12);
    doc.setFont(undefined, 'normal');

    let y = 20;

    if (dette < 0) {
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text(`Report dette : ${fmt(dette)} €`, margin, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      y += 8;
    }

    y += 2;

    // Left table: Fiches (Date | Type | H | Montant)
    const leftX = margin;
    const leftCols = [
      { header: 'Date', w: 26 },
      { header: 'Type', w: 20 },
      { header: 'H', w: 14 },
      { header: 'Montant', w: 28 },
    ]; // 88mm

    // Right table: Notes clients (Client | Date | Montant)
    const rightX = leftX + leftCols.reduce((a, c) => a + c.w, 0) + 8; // 12+88+8=108
    const rightCols = [{ header: 'Client', w: 40 }, { header: 'Date', w: 22 }, { header: 'Montant', w: 26 }]; // 88mm

    const drawRow = (startX, cols, cy, cells, bold = false) => {
      let x = startX;
      doc.setFont(undefined, bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 8.5 : 8);
      cols.forEach((col, i) => {
        doc.rect(x, cy, col.w, rowH);
        const val = cells[i];
        if (val !== undefined && val !== '') {
          let txt = String(val);
          const maxW = col.w - 2;
          while (doc.getTextWidth(txt) > maxW && txt.length > 1) txt = txt.slice(0, -1);
          doc.text(txt, x + 1.2, cy + rowH - 1.8);
        }
        x += col.w;
      });
    };

    // Section labels
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'bold');
    doc.text('Fiches', leftX, y - 1);
    doc.text('Notes clients reçues', rightX, y - 1);
    doc.setFont(undefined, 'normal');

    // Headers
    drawRow(leftX, leftCols, y, leftCols.map((c) => c.header), true);
    drawRow(rightX, rightCols, y, rightCols.map((c) => c.header), true);

    let leftY = y + rowH;
    let rightY = y + rowH;

    // Fiches rows (salaire/retrait only, sorted by date desc)
    [...fichesActives].sort((a, b) => b.date.localeCompare(a.date)).forEach((f) => {
      drawRow(leftX, leftCols, leftY, [
        fmtDate(f.date),
        f.type === 'retrait' ? 'Retrait' : 'Salaire',
        f.type === 'salaire' ? f.heures + 'h' : '',
        fmt(f.montant) + ' €',
      ]);
      leftY += rowH;
    });
    // Fiches total
    drawRow(leftX, leftCols, leftY, ['Total', '', '', fmt(totalFiches) + ' €'], true);
    leftY += rowH;

    // Notes clients rows
    notesClients.forEach((n) => {
      drawRow(rightX, rightCols, rightY, [n.personne || '', fmtDate(n.date), fmt(n.montant) + ' €']);
      rightY += rowH;
    });
    if (notesClients.length > 0) {
      drawRow(rightX, rightCols, rightY, ['Total notes', '', fmt(totalNotes) + ' €'], true);
      rightY += rowH;
    }

    // Notes remboursées
    if (rembFiches.length > 0) {
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Notes remboursées', rightX + 1, rightY + rowH - 2);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.rect(rightX, rightY, rightCols.reduce((a, c) => a + c.w, 0), rowH);
      rightY += rowH;
      rembFiches.forEach((f) => {
        drawRow(rightX, rightCols, rightY, [f.notePersonne || '', fmtDate(f.noteDate || f.date), '+' + fmt(Math.abs(f.montant)) + ' €']);
        rightY += rowH;
      });
      drawRow(rightX, rightCols, rightY, ['Total remb.', '', '+' + fmt(totalRemb) + ' €'], true);
      rightY += rowH;
    }

    y = Math.max(leftY, rightY) + 8;

    // BK section
    const bkSectionCols = [{ header: 'Date', w: 28 }, { header: 'Montant', w: 30 }];
    if (bkFiches.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(234, 88, 12);
      doc.text('BK (déduit du total)', margin, y - 1);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      drawRow(margin, bkSectionCols, y, bkSectionCols.map((c) => c.header), true);
      y += rowH;
      bkFiches.forEach((f) => {
        drawRow(margin, bkSectionCols, y, [fmtDate(f.date), fmt(f.montant) + ' €']);
        y += rowH;
      });
      drawRow(margin, bkSectionCols, y, ['Total BK', fmt(totalBk) + ' €'], true);
      y += rowH + 8;
    }

    // Grand total
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Général : ${fmt(totalGeneral)} €`, margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    let formula = `${fmt(totalFiches)} (fiches) + ${fmt(totalNotes)} (notes) + ${fmt(totalRemb)} (remb.) − ${fmt(totalBk)} (BK)`;
    if (dette !== 0) formula += ` + ${fmt(dette)} (report)`;
    formula += ` = ${fmt(totalGeneral)} €`;
    doc.text(formula, margin, y);

    doc.save('pierre-fiches.pdf');
  };

  return (
    <div className="page-container">
      {confirmReset && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Réinitialiser Pierre</h3>
            <p>Toutes les fiches de Pierre seront supprimées. Les notes resteront visibles dans Notes Clients. Si le total est négatif, la dette sera reportée à la prochaine période.</p>
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

      {dette < 0 && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600, borderLeft: '4px solid #dc2626' }}>
          Report période précédente : {fmt(dette)} €
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Pierre</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setConfirmReset(true)}>Réinitialiser</button>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handlePrint}>Imprimer</button>
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
                    background: f.type === 'retrait' ? '#fef2f2' : f.type === 'remboursement_note' ? '#eff6ff' : '#f0fdf4',
                    color: f.type === 'retrait' ? '#dc2626' : f.type === 'remboursement_note' ? '#2563eb' : '#15803d',
                  }}>{f.type === 'retrait' ? 'Retrait' : f.type === 'remboursement_note' ? 'Remb.' : 'Salaire'}</span>
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
          {fichesActives.length > 0 && (
            <div style={{ marginTop: 10, fontWeight: 700, color: '#2563eb' }}>
              Total fiches : {fmt(totalFiches)} €
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
                <input className="input-field" type="number" placeholder="0" value={noteForm.montant} onChange={(e) => setNoteForm({ ...noteForm, montant: e.target.value })} />
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

          {rembFiches.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #2563eb' }}>
              <div className="card-title" style={{ color: '#2563eb' }}>Notes remboursées</div>
              {rembFiches.map((f) => (
                <div key={f.id} className="row-hover nota-row">
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {f.notePersonne}
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                      {f.noteDate ? f.noteDate.split('-').reverse().join('/') : ''} — remb. {f.date ? f.date.split('-').reverse().join('/') : ''}
                    </span>
                  </span>
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>+{fmt(Math.abs(f.montant))} €</span>
                  <button className="btn btn-secondary" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }} title="Annuler le remboursement" onClick={() => { annulerRemboursement(f.noteId); load(); }}>↩</button>
                </div>
              ))}
              <div style={{ marginTop: 10, fontWeight: 700, color: '#2563eb' }}>
                Total remboursements : {fmt(totalRemb)} €
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BK */}
      <div className="card" style={{ borderLeft: '4px solid #ea580c' }}>
        <div className="card-title" style={{ color: '#ea580c' }}>Pour BK</div>
        {bkFiches.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune entrée</div>}
        {bkFiches.map((f) => (
          <div key={f.id} className="row-hover nota-row">
            <span style={{ flex: 1, color: '#6b7280', fontSize: 13 }}>{fmtDate(f.date)}</span>
            <span style={{ fontWeight: 600, color: '#ea580c' }}>{fmt(f.montant)} €</span>
            <button className="delete-btn" onClick={() => handleDelete(f.id)}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="input-field"
            type="number"
            placeholder="Montant BK..."
            value={bkInput}
            onChange={(e) => setBkInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBk()}
            style={{ flex: 1 }}
          />
          <button className="btn" style={{ background: '#ea580c', color: 'white' }} onClick={handleAddBk}>+</button>
        </div>
        <div style={{ marginTop: 10, fontWeight: 700, color: '#ea580c' }}>
          Total BK : {fmt(totalBk)} €
        </div>
      </div>

      {/* Total Général */}
      <div className="blue-total" style={{ fontSize: 18, padding: '16px 20px' }}>
        Total Général : {fmt(totalGeneral)} €
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          {fmt(totalFiches)} (fiches) + {fmt(totalNotes)} (notes) + {fmt(totalRemb)} (remb.) − {fmt(totalBk)} (BK)
          {dette !== 0 && ` + ${fmt(dette)} (report)`}
        </div>
      </div>
    </div>
  );
}
