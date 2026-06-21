import { useState, useEffect } from 'react';
import {
  getFichesPierre, addFichePierre, deleteFichePierre, updateFichePierre, deleteFichesPierreMois,
  getNotes, addNote, getPersonnes, resetPierre, getHiddenNotes, getDette, annulerRemboursement,
  getPierreMonthReports, savePierreMonthReports,
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
const nextMonth = (mois) => {
  const [y, m] = mois.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
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
  const [confirmValider, setConfirmValider] = useState(false);
  const [bkInput, setBkInput] = useState('');
  const [bkDate, setBkDate] = useState(today());
  const [dette, setDette] = useState(0);
  const [monthReports, setMonthReports] = useState({});

  const load = () => {
    const all = getFichesPierre().sort((a, b) => b.date.localeCompare(a.date));
    setFiches(all);
    const rembIds = new Set(all.filter((f) => f.type === 'remboursement_note').map((f) => f.noteId).filter(Boolean));
    const hidden = getHiddenNotes();
    setNotesClients(getNotes().filter((n) => n.destinataire_key === 'pierre' && !n.annulee && !hidden.includes(n.id) && !rembIds.has(n.id)));
    setPersonnesList(getPersonnes());
    setDette(getDette('pierre'));
    setMonthReports(getPierreMonthReports());
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

  // Exclude bk and remboursement_note from the main fiches display — only salaire + retrait
  const fichesActives = fiches.filter((f) => f.type === 'salaire' || f.type === 'retrait');
  const rembFiches = fiches.filter((f) => f.type === 'remboursement_note');
  const bkFiches = fiches.filter((f) => f.type === 'bk');

  // Group by month — track salaires and retraits separately
  const moisMap = fichesActives.reduce((acc, f) => {
    const m = f.mois || f.date.substring(0, 7);
    if (!acc[m]) acc[m] = { salaires: 0, retraits: 0, fiches: [] };
    if (f.type === 'salaire') acc[m].salaires += f.montant;
    if (f.type === 'retrait') acc[m].retraits += Math.abs(f.montant);
    acc[m].fiches.push(f);
    return acc;
  }, {});
  const moisList = Object.keys(moisMap).sort((a, b) => b.localeCompare(a));

  const fichesOfMois = selectedMois ? (moisMap[selectedMois]?.fiches || []) : [];
  const salairesDuMois = [...fichesOfMois].filter((f) => f.type === 'salaire').sort((a, b) => b.date.localeCompare(a.date));
  const retraitsDuMois = [...fichesOfMois].filter((f) => f.type === 'retrait').sort((a, b) => b.date.localeCompare(a.date));
  const totalSalairesMois = salairesDuMois.reduce((a, b) => a + b.montant, 0);
  const totalRetraitsMois = retraitsDuMois.reduce((a, b) => a + Math.abs(b.montant), 0);

  const bkFichesDuMois = bkFiches.filter((f) => (f.date || '').substring(0, 7) === selectedMois);
  const totalBk = bkFichesDuMois.reduce((a, b) => a + b.montant, 0);
  const notesClientsDuMois = notesClients.filter((n) => (n.date || '').substring(0, 7) === selectedMois);
  const totalNotes = notesClientsDuMois.reduce((a, b) => a + b.montant, 0);
  const rembFichesDuMois = rembFiches.filter((f) => (f.date || '').substring(0, 7) === selectedMois);
  const totalRemb = rembFichesDuMois.reduce((a, b) => a + Math.abs(b.montant), 0);

  // Carry-over: use month report if available (already includes previous dette), else fall back to global dette
  const reportDuMoisPrecedent = monthReports[selectedMois] !== undefined ? monthReports[selectedMois] : dette;
  // Notes are stored with their natural sign (negative = reduces Pierre's total, positive = increases)
  const totalGeneral = totalSalairesMois - totalRetraitsMois + totalNotes + totalRemb - totalBk + reportDuMoisPrecedent;

  const handleValiderMois = () => {
    const reports = getPierreMonthReports();
    reports[nextMonth(selectedMois)] = totalGeneral;
    savePierreMonthReports(reports);
    setConfirmValider(false);
    load();
    flash(`✓ ${fmtMois(selectedMois)} validé — Report : ${fmt(totalGeneral)} €`);
  };

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

  const handleDelete = (id) => { deleteFichePierre(id); load(); };

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
    addFichePierre({ date: bkDate || today(), montantDirect: parseFloat(bkInput), type: 'bk' });
    setBkInput('');
    load();
  };

  const handlePrint = () => {
    const row = (cells, cls = '') => `<tr class="${cls}">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    const rowH = (cells) => `<tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr>`;

    const rembNoteIdsThisMois = new Set(rembFichesDuMois.map((f) => f.noteId).filter(Boolean));

    const salairesRows = salairesDuMois.map((f) => row([fmtDate(f.date), f.heures + 'h', fmt(f.montant) + ' €'])).join('');
    const retraitsRows = retraitsDuMois.map((f) => row([fmtDate(f.date), fmt(Math.abs(f.montant)) + ' €'])).join('');

    const allNotesMois = getNotes()
      .filter((n) => n.destinataire_key === 'pierre' && !n.annulee && (n.date || '').substring(0, 7) === selectedMois)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const noteRows = allNotesMois.map((n) => {
      const barré = rembNoteIdsThisMois.has(n.id);
      const style = barré ? ' style="text-decoration:line-through;opacity:0.55"' : '';
      return `<tr${style}><td>${n.personne || ''}</td><td>${fmtDate(n.date)}</td><td>${fmt(n.montant)} €</td></tr>`;
    }).join('');
    const rembRows = rembFichesDuMois.map((f) => row([f.notePersonne || '', fmtDate(f.noteDate || f.date), '+' + fmt(Math.abs(f.montant)) + ' €'])).join('');

    const bkSection = bkFichesDuMois.length ? `
      <h3 class="bk-titre">BK (déduit du total)</h3>
      <table><thead>${rowH(['Date', 'Montant'])}</thead><tbody>
        ${bkFichesDuMois.map((f) => row([fmtDate(f.date), fmt(f.montant) + ' €'])).join('')}
        ${row(['Total BK', fmt(totalBk) + ' €'], 'total-row')}
      </tbody></table>` : '';

    const reportLine = reportDuMoisPrecedent !== 0 ? `<p class="dette">Report période précédente : ${fmt(reportDuMoisPrecedent)} €</p>` : '';
    const notesSign = totalNotes >= 0 ? `+ ${fmt(totalNotes)}` : `− ${fmt(Math.abs(totalNotes))}`;
    const formula = `${fmt(totalSalairesMois)} (sal.) − ${fmt(totalRetraitsMois)} (retraits) ${notesSign} (notes) + ${fmt(totalRemb)} (remb.) − ${fmt(totalBk)} (BK)${reportDuMoisPrecedent !== 0 ? ` + ${fmt(reportDuMoisPrecedent)} (report)` : ''} = ${fmt(totalGeneral)} €`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pierre — ${fmtMois(selectedMois)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:9pt;padding:12mm;color:#000}
  h1{font-size:13pt;margin-bottom:6px}
  .dette{color:#dc2626;font-weight:700;margin-bottom:8px}
  .trois-cols{display:flex;gap:10px;margin-bottom:12px;align-items:flex-start}
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
<h1>Pierre — ${fmtMois(selectedMois)}</h1>
${reportLine}
<div class="trois-cols">
  <div class="col">
    <div class="col-titre">Salaires</div>
    <table><thead>${rowH(['Date', 'H', 'Montant'])}</thead><tbody>
      ${salairesRows}
      ${row(['Total', '', fmt(totalSalairesMois) + ' €'], 'total-row')}
    </tbody></table>
  </div>
  <div class="col">
    <div class="col-titre" style="color:#dc2626">Retraits (−)</div>
    <table><thead>${rowH(['Date', 'Montant'])}</thead><tbody>
      ${retraitsRows || '<tr><td colspan="2" style="color:#999">Aucun</td></tr>'}
      ${row(['Total', fmt(totalRetraitsMois) + ' €'], 'total-row')}
    </tbody></table>
  </div>
  <div class="col">
    <div class="col-titre">Notes clients reçues (−)</div>
    <table><thead>${rowH(['Client', 'Date', 'Montant'])}</thead><tbody>
      ${noteRows || '<tr><td colspan="3" style="color:#999">Aucune</td></tr>'}
      ${allNotesMois.length ? row(['Total notes', '', fmt(totalNotes) + ' €'], 'total-row') : ''}
      ${rembFichesDuMois.length ? `<tr class="remb-titre"><td colspan="3">Notes remboursées (+)</td></tr>${rembRows}${row(['Total remb.', '', '+' + fmt(totalRemb) + ' €'], 'total-row')}` : ''}
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
    let y = 20;

    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text(`Pierre — ${fmtMois(selectedMois)}`, margin, 12);
    doc.setFont(undefined, 'normal');

    if (reportDuMoisPrecedent !== 0) {
      doc.setFontSize(10); doc.setFont(undefined, 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text(`Report période précédente : ${fmt(reportDuMoisPrecedent)} €`, margin, y);
      doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
      y += 8;
    }
    y += 2;

    // Three-column layout
    // Salaires: Date(20) + H(12) + Montant(22) = 54mm
    // Gap: 5mm
    // Retraits: Date(20) + Montant(22) = 42mm
    // Gap: 5mm
    // Notes: Client(34) + Date(18) + Montant(24) = 76mm
    // Total: 54+5+42+5+76 = 182mm + 12(margin) = 194mm < 210mm ✓
    const salCols = [{ header: 'Date', w: 20 }, { header: 'H', w: 12 }, { header: 'Montant', w: 22 }];
    const retCols = [{ header: 'Date', w: 20 }, { header: 'Montant', w: 22 }];
    const noteCols = [{ header: 'Client', w: 34 }, { header: 'Date', w: 18 }, { header: 'Montant', w: 24 }];

    const salX = margin;
    const retX = salX + 54 + 5;
    const noteX = retX + 42 + 5;

    const drawRow = (startX, cols, cy, cells, bold = false, strikethrough = false) => {
      let x = startX;
      doc.setFont(undefined, bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 8.5 : 8);
      if (strikethrough) doc.setTextColor(150, 150, 150);
      cols.forEach((col, i) => {
        doc.rect(x, cy, col.w, rowH);
        const val = cells[i];
        if (val !== undefined && val !== '') {
          let txt = String(val);
          const maxW = col.w - 2;
          while (doc.getTextWidth(txt) > maxW && txt.length > 1) txt = txt.slice(0, -1);
          doc.text(txt, x + 1.2, cy + rowH - 1.8);
          if (strikethrough) doc.line(x + 1.2, cy + rowH / 2, x + col.w - 1.2, cy + rowH / 2);
        }
        x += col.w;
      });
      if (strikethrough) doc.setTextColor(0, 0, 0);
    };

    // Section labels
    doc.setFontSize(8.5); doc.setFont(undefined, 'bold');
    doc.text('Salaires', salX, y - 1);
    doc.setTextColor(220, 38, 38); doc.text('Retraits (−)', retX, y - 1); doc.setTextColor(0, 0, 0);
    doc.text('Notes clients reçues (−)', noteX, y - 1);
    doc.setFont(undefined, 'normal');

    drawRow(salX, salCols, y, salCols.map((c) => c.header), true);
    drawRow(retX, retCols, y, retCols.map((c) => c.header), true);
    drawRow(noteX, noteCols, y, noteCols.map((c) => c.header), true);

    let salY = y + rowH;
    let retY = y + rowH;
    let noteY = y + rowH;

    // Salaires
    salairesDuMois.forEach((f) => {
      drawRow(salX, salCols, salY, [fmtDate(f.date), f.heures + 'h', fmt(f.montant) + ' €']);
      salY += rowH;
    });
    drawRow(salX, salCols, salY, ['Total', '', fmt(totalSalairesMois) + ' €'], true);
    salY += rowH;

    // Retraits
    if (retraitsDuMois.length === 0) {
      drawRow(retX, retCols, retY, ['Aucun', '']);
      retY += rowH;
    } else {
      retraitsDuMois.forEach((f) => {
        drawRow(retX, retCols, retY, [fmtDate(f.date), fmt(Math.abs(f.montant)) + ' €']);
        retY += rowH;
      });
    }
    drawRow(retX, retCols, retY, ['Total', fmt(totalRetraitsMois) + ' €'], true);
    retY += rowH;

    // Notes
    const rembNoteIdsThisMois = new Set(rembFichesDuMois.map((f) => f.noteId).filter(Boolean));
    const allNotesMoisPDF = getNotes()
      .filter((n) => n.destinataire_key === 'pierre' && !n.annulee && (n.date || '').substring(0, 7) === selectedMois)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (allNotesMoisPDF.length === 0) {
      drawRow(noteX, noteCols, noteY, ['Aucune', '', '']);
      noteY += rowH;
    } else {
      allNotesMoisPDF.forEach((n) => {
        drawRow(noteX, noteCols, noteY, [n.personne || '', fmtDate(n.date), fmt(n.montant) + ' €'], false, rembNoteIdsThisMois.has(n.id));
        noteY += rowH;
      });
      drawRow(noteX, noteCols, noteY, ['Total notes', '', fmt(totalNotes) + ' €'], true);
      noteY += rowH;
    }

    // Remboursements
    if (rembFichesDuMois.length > 0) {
      doc.setFontSize(7.5); doc.setFont(undefined, 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Notes remboursées (+)', noteX + 1, noteY + rowH - 2);
      doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
      doc.rect(noteX, noteY, noteCols.reduce((a, c) => a + c.w, 0), rowH);
      noteY += rowH;
      rembFichesDuMois.forEach((f) => {
        drawRow(noteX, noteCols, noteY, [f.notePersonne || '', fmtDate(f.noteDate || f.date), '+' + fmt(Math.abs(f.montant)) + ' €']);
        noteY += rowH;
      });
      drawRow(noteX, noteCols, noteY, ['Total remb.', '', '+' + fmt(totalRemb) + ' €'], true);
      noteY += rowH;
    }

    y = Math.max(salY, retY, noteY) + 8;

    // BK section
    const bkSectionCols = [{ header: 'Date', w: 28 }, { header: 'Montant', w: 30 }];
    if (bkFichesDuMois.length > 0) {
      doc.setFontSize(8.5); doc.setFont(undefined, 'bold');
      doc.setTextColor(234, 88, 12);
      doc.text('BK (déduit du total)', margin, y - 1);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      drawRow(margin, bkSectionCols, y, bkSectionCols.map((c) => c.header), true);
      y += rowH;
      bkFichesDuMois.forEach((f) => { drawRow(margin, bkSectionCols, y, [fmtDate(f.date), fmt(f.montant) + ' €']); y += rowH; });
      drawRow(margin, bkSectionCols, y, ['Total BK', fmt(totalBk) + ' €'], true);
      y += rowH + 8;
    }

    // Grand total
    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text(`Total Général : ${fmt(totalGeneral)} €`, margin, y);
    y += 6;
    doc.setFontSize(8); doc.setFont(undefined, 'normal');
    const notesSignPDF = totalNotes >= 0 ? `+ ${fmt(totalNotes)}` : `- ${fmt(Math.abs(totalNotes))}`;
    let formula = `${fmt(totalSalairesMois)} (sal.) - ${fmt(totalRetraitsMois)} (retraits) ${notesSignPDF} (notes) + ${fmt(totalRemb)} (remb.) - ${fmt(totalBk)} (BK)`;
    if (reportDuMoisPrecedent !== 0) formula += ` + ${fmt(reportDuMoisPrecedent)} (report)`;
    formula += ` = ${fmt(totalGeneral)} €`;
    doc.text(formula, margin, y);

    doc.save('pierre-fiches.pdf');
  };

  const renderFicheRow = (f) => (
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
          {f.type === 'salaire' && <span style={{ width: 50, fontSize: 12, color: '#6b7280' }}>{f.heures}h</span>}
          <span style={{ flex: 1, fontWeight: 600 }}>{fmt(f.type === 'retrait' ? Math.abs(f.montant) : f.montant)} €</span>
          {f.notes && <span style={{ color: '#9ca3af', fontSize: 12, flex: 1 }}>{f.notes}</span>}
          <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}>✕</button>
        </div>
      )}
    </div>
  );

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

      {confirmValider && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Valider {fmtMois(selectedMois)}</h3>
            <p>
              Le total de ce mois (<strong>{fmt(totalGeneral)} €</strong>) sera reporté comme solde de départ pour <strong>{fmtMois(nextMonth(selectedMois))}</strong>.
              {totalGeneral < 0 && ' La dette sera portée au mois suivant.'}
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmValider(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleValiderMois}>Valider</button>
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

      {reportDuMoisPrecedent < 0 && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600, borderLeft: '4px solid #dc2626' }}>
          Report période précédente : {fmt(reportDuMoisPrecedent)} €
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
                <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.8 }}>{fmt(moisMap[m].salaires)} €</span>
                {moisMap[m].retraits > 0 && (
                  <span style={{ marginLeft: 4, fontWeight: 400, opacity: 0.7, color: selectedMois === m ? '#fca5a5' : '#dc2626' }}>−{fmt(moisMap[m].retraits)} €</span>
                )}
                {monthReports[nextMonth(m)] !== undefined && (
                  <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fiches du mois sélectionné — deux colonnes */}
      {selectedMois && (
        <div className="card" style={{ borderTopLeftRadius: moisList.length > 0 ? 0 : undefined, borderTopRightRadius: moisList.length > 0 ? 0 : undefined, borderTop: moisList.length > 0 ? '1px solid #e5e7eb' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: '#1f2937' }}>{fmtMois(selectedMois)}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {moisMap[selectedMois] && (
                <>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setConfirmValider(true)}
                  >
                    Valider le mois
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setConfirmDeleteMois(selectedMois)}
                  >
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Report du mois précédent si validé */}
          {monthReports[selectedMois] !== undefined && (
            <div style={{ background: monthReports[selectedMois] < 0 ? '#fef2f2' : '#f0fdf4', color: monthReports[selectedMois] < 0 ? '#dc2626' : '#15803d', padding: '6px 12px', borderRadius: 6, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
              Report {fmtMois(/* previous month */ (() => { const [y, mo] = selectedMois.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; })())} : {fmt(monthReports[selectedMois])} €
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Colonne Salaires */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#15803d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Salaires</div>
              {salairesDuMois.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucun</div>}
              {salairesDuMois.map(renderFicheRow)}
              {salairesDuMois.length > 0 && (
                <div style={{ marginTop: 8, fontWeight: 700, color: '#15803d', fontSize: 13 }}>
                  Total : {fmt(totalSalairesMois)} €
                </div>
              )}
            </div>

            {/* Colonne Retraits */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#dc2626', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Retraits (−)</div>
              {retraitsDuMois.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucun</div>}
              {retraitsDuMois.map(renderFicheRow)}
              {retraitsDuMois.length > 0 && (
                <div style={{ marginTop: 8, fontWeight: 700, color: '#dc2626', fontSize: 13 }}>
                  Total : {fmt(totalRetraitsMois)} €
                </div>
              )}
            </div>
          </div>
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
            <div className="card-title">Notes clients reçues (−)</div>
            <div className="blue-total" style={{ marginBottom: 14, background: totalNotes < 0 ? '#fef2f2' : undefined, color: totalNotes < 0 ? '#dc2626' : undefined }}>
              Total : {fmt(totalNotes)} €
            </div>
            {(() => {
              const notesDuMois = notesClients.filter((n) => (n.date || '').substring(0, 7) === selectedMois);
              if (notesDuMois.length === 0) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune note ce mois</div>;
              return [...notesDuMois].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((n) => (
                <div key={n.id} className="nota-row">
                  <span style={{ flex: 1, fontSize: 13 }}>{n.personne} → Pierre ({fmtDate(n.date)})</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>{fmt(n.montant)} €</span>
                </div>
              ));
            })()}
          </div>

          {rembFichesDuMois.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #2563eb' }}>
              <div className="card-title" style={{ color: '#2563eb' }}>Notes remboursées (+)</div>
              {rembFichesDuMois.map((f) => (
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
        {bkFichesDuMois.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune entrée ce mois</div>}
        {bkFichesDuMois.map((f) => (
          <div key={f.id} className="row-hover nota-row">
            <span style={{ flex: 1, color: '#6b7280', fontSize: 13 }}>{fmtDate(f.date)}</span>
            <span style={{ fontWeight: 600, color: '#ea580c' }}>{fmt(f.montant)} €</span>
            <button className="delete-btn" onClick={() => handleDelete(f.id)}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="input-field" type="date" value={bkDate} onChange={(e) => setBkDate(e.target.value)} style={{ width: 140 }} />
          <input className="input-field" type="number" placeholder="Montant BK..." value={bkInput}
            onChange={(e) => setBkInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddBk()} style={{ flex: 1 }} />
          <button className="btn" style={{ background: '#ea580c', color: 'white' }} onClick={handleAddBk}>+</button>
        </div>
        <div style={{ marginTop: 10, fontWeight: 700, color: '#ea580c' }}>Total BK : {fmt(totalBk)} €</div>
      </div>

      {/* Total Général */}
      <div className="blue-total" style={{ fontSize: 18, padding: '16px 20px' }}>
        Total Général : {fmt(totalGeneral)} €
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          {fmt(totalSalairesMois)} (sal.) − {fmt(totalRetraitsMois)} (retraits) {totalNotes >= 0 ? `+ ${fmt(totalNotes)}` : `− ${fmt(Math.abs(totalNotes))}`} (notes) + {fmt(totalRemb)} (remb.) − {fmt(totalBk)} (BK)
          {reportDuMoisPrecedent !== 0 && ` + ${fmt(reportDuMoisPrecedent)} (report)`}
        </div>
      </div>
    </div>
  );
}
