import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPersonnes, getFiches, getNotes, getHiddenNotes,
  deleteFiche, toggleNoteHidden, addFiche, addPersonne, slugify, resetServeur, getDette,
  getBopGlobal, setBopGlobal,
} from '../db';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

export default function Personne() {
  const { key } = useParams();
  const [personne, setPersonne] = useState(null);
  const [fiches, setFiches] = useState([]);
  const [notes, setNotes] = useState([]);
  const [hidden, setHidden] = useState([]);
  const [showAnnulees, setShowAnnulees] = useState(false);
  const [bopInput, setBopInput] = useState('');
  const [bkInput, setBkInput] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [dette, setDette] = useState(0);
  const [bopGlobal, setBopGlobalState] = useState(0);
  const [bopGlobalInput, setBopGlobalInput] = useState('');

  const load = () => {
    const personnes = getPersonnes();
    const p = personnes.find((p) => p.key === key);
    setPersonne(p || { key, nom: key });
    setFiches(getFiches());
    setNotes(getNotes());
    setHidden(getHiddenNotes());
    setDette(getDette(key));
    setBopGlobalState(getBopGlobal(key));
  };

  useEffect(() => { load(); }, [key]);

  const salaires = fiches.filter((f) => f.personne_key === key && f.type === 'salaire');
  const bopFiches = fiches.filter((f) => f.personne_key === key && f.type === 'bop');
  const bkFiches = fiches.filter((f) => f.personne_key === key && f.type === 'bk');
  const notesRecues = notes.filter((n) => n.destinataire_key === key && !hidden.includes(n.id));
  const notesRecuesAll = notes.filter((n) => n.destinataire_key === key);

  const totalSalaires = salaires.reduce((a, b) => a + b.montant, 0);
  const totalNotes = notesRecues.filter((n) => !n.annulee).reduce((a, b) => a + b.montant, 0);
  const totalBop = bopFiches.reduce((a, b) => a + b.montant, 0);
  const totalBk = bkFiches.reduce((a, b) => a + b.montant, 0);
  const totalGeneral = totalSalaires + totalNotes - totalBop - totalBk + dette;

  const handleReset = () => {
    resetServeur(key);
    setConfirmReset(false);
    load();
  };

  const handleDeleteFiche = (id) => {
    deleteFiche(id);
    load();
  };

  const handleHideNote = (id) => {
    toggleNoteHidden(id);
    load();
  };

  const handleAddBop = () => {
    if (!bopInput) return;
    addPersonne(personne.nom);
    addFiche(key, personne.nom, new Date().toISOString().slice(0, 10), parseFloat(bopInput), 'bop');
    setBopInput('');
    load();
  };

  const handleAddBk = () => {
    if (!bkInput) return;
    addPersonne(personne.nom);
    addFiche(key, personne.nom, new Date().toISOString().slice(0, 10), parseFloat(bkInput), 'bk');
    setBkInput('');
    load();
  };

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 12;
    const rowH = 7;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(personne?.nom || key, margin, 12);
    doc.setFont(undefined, 'normal');

    let y = 22;

    // Left table: Salaires (Date | Montant)
    const leftX = margin;
    const leftCols = [{ header: 'Date', w: 28 }, { header: 'Montant', w: 30 }];
    const leftW = leftCols.reduce((a, c) => a + c.w, 0); // 58mm

    // Right table: Notes clients (Client | Date | Montant)
    const rightX = leftX + leftW + 8;
    const rightCols = [{ header: 'Client', w: 44 }, { header: 'Date', w: 22 }, { header: 'Montant', w: 26 }];

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

    // Section labels above tables
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'bold');
    doc.text('Salaires', leftX, y - 1);
    doc.text('Notes clients reçues', rightX, y - 1);
    doc.setFont(undefined, 'normal');

    // Headers
    drawRow(leftX, leftCols, y, leftCols.map((c) => c.header), true);
    drawRow(rightX, rightCols, y, rightCols.map((c) => c.header), true);

    let leftY = y + rowH;
    let rightY = y + rowH;

    // Salaires rows
    salaires.forEach((f) => {
      drawRow(leftX, leftCols, leftY, [fmtDate(f.date), fmt(f.montant) + ' €']);
      leftY += rowH;
    });
    // Salaires total
    drawRow(leftX, leftCols, leftY, ['Total', fmt(totalSalaires) + ' €'], true);
    leftY += rowH;

    // Notes clients rows
    const activeNotes = notesRecues.filter((n) => !n.annulee);
    activeNotes.forEach((n) => {
      drawRow(rightX, rightCols, rightY, [n.personne || '', fmtDate(n.date), fmt(n.montant) + ' €']);
      rightY += rowH;
    });
    // Notes total
    drawRow(rightX, rightCols, rightY, ['Total', '', fmt(totalNotes) + ' €'], true);
    rightY += rowH;

    y = Math.max(leftY, rightY) + 8;

    // BOP section
    const sectionCols = [{ header: 'Date', w: 28 }, { header: 'Montant', w: 30 }];
    if (bopFiches.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text('BOP (déduit du total)', margin, y - 1);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      drawRow(margin, sectionCols, y, sectionCols.map((c) => c.header), true);
      y += rowH;
      bopFiches.forEach((f) => {
        drawRow(margin, sectionCols, y, [fmtDate(f.date), fmt(f.montant) + ' €']);
        y += rowH;
      });
      drawRow(margin, sectionCols, y, ['Total BOP', fmt(totalBop) + ' €'], true);
      y += rowH + 8;
    }

    // BK section
    if (bkFiches.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(234, 88, 12);
      doc.text('BK (déduit du total)', margin, y - 1);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      drawRow(margin, sectionCols, y, sectionCols.map((c) => c.header), true);
      y += rowH;
      bkFiches.forEach((f) => {
        drawRow(margin, sectionCols, y, [fmtDate(f.date), fmt(f.montant) + ' €']);
        y += rowH;
      });
      drawRow(margin, sectionCols, y, ['Total BK', fmt(totalBk) + ' €'], true);
      y += rowH + 8;
    }

    // Grand total
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Général : ${fmt(totalGeneral)} €`, margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    let formula = `${fmt(totalSalaires)} (sal.) + ${fmt(totalNotes)} (notes) - ${fmt(totalBop)} (BOP) - ${fmt(totalBk)} (BK)`;
    if (dette !== 0) formula += ` + ${fmt(dette)} (report)`;
    formula += ` = ${fmt(totalGeneral)} €`;
    doc.text(formula, margin, y);

    if (bopGlobal !== 0) {
      y += 8;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(220, 38, 38);
      doc.text(`BOP total : ${fmt(bopGlobal)} €`, margin, y);
      doc.setTextColor(0, 0, 0);
    }

    doc.save(`${key}.pdf`);
  };

  const exportWord = async () => {
    const { Document, Table, TableRow, TableCell, Paragraph, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, Packer } = await import('docx');

    const makeRow = (cells, bold = false) => new TableRow({
      children: cells.map((text) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text), bold })] })],
        width: { size: 16, type: WidthType.PERCENTAGE },
      })),
    });

    const rows = [];
    rows.push(makeRow(['Date salaire', 'Montant sal.', 'Personne note', 'Montant note', 'BOP', 'BK'], true));

    const maxLen = Math.max(salaires.length, notesRecues.filter(n => !n.annulee).length, bopFiches.length, bkFiches.length, 1);
    const activeNotes = notesRecues.filter(n => !n.annulee);
    for (let i = 0; i < maxLen; i++) {
      rows.push(makeRow([
        salaires[i] ? fmtDate(salaires[i].date) : '',
        salaires[i] ? fmt(salaires[i].montant) + ' €' : '',
        activeNotes[i] ? activeNotes[i].personne : '',
        activeNotes[i] ? fmt(activeNotes[i].montant) + ' €' : '',
        bopFiches[i] ? fmt(bopFiches[i].montant) + ' €' : '',
        bkFiches[i] ? fmt(bkFiches[i].montant) + ' €' : '',
      ]));
    }
    rows.push(makeRow([
      'TOTAUX',
      fmt(totalSalaires) + ' €',
      '',
      fmt(totalNotes) + ' €',
      fmt(totalBop) + ' €',
      fmt(totalBk) + ' €',
    ], true));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: personne?.nom || key, heading: HeadingLevel.HEADING_1 }),
          new Table({ rows }),
          new Paragraph({ children: [new TextRun({ text: `Total Général: ${fmt(totalGeneral)} €`, bold: true, size: 28 })] }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    saveAs(new Blob([buffer]), `${key}.docx`);
  };

  if (!personne) return <div className="page-container">Chargement...</div>;

  return (
    <div className="page-container">
      {confirmReset && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Réinitialiser {personne.nom}</h3>
            <p>Toutes les fiches (salaires, BOP, BK) seront supprimées. Les notes resteront visibles dans Notes Clients mais plus sur cette fiche. Si le total est négatif, la dette sera reportée à la prochaine période.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>Annuler</button>
              <button className="btn btn-danger" onClick={handleReset}>Réinitialiser</button>
            </div>
          </div>
        </div>
      )}

      {dette < 0 && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600, borderLeft: '4px solid #dc2626' }}>
          Report période précédente : {fmt(dette)} €
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{personne.nom}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-danger" style={{ fontSize: 13 }} onClick={() => setConfirmReset(true)}>Réinitialiser</button>
          <button className="btn btn-primary" onClick={exportPDF}>Export PDF</button>
          <button className="btn btn-secondary" onClick={exportWord}>Export Word</button>
        </div>
      </div>

      {/* Salaires */}
      <div className="card">
        <div className="card-title">Salaires</div>
        {salaires.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucun salaire</div>}
        {salaires.map((f) => (
          <div key={f.id} className="row-hover nota-row">
            <span style={{ flex: 1, color: '#6b7280', fontSize: 13 }}>{fmtDate(f.date)}</span>
            <span style={{ fontWeight: 600 }}>{fmt(f.montant)} €</span>
            <button className="delete-btn" onClick={() => handleDeleteFiche(f.id)}>✕</button>
          </div>
        ))}
        <div style={{ marginTop: 10, fontWeight: 700, color: '#2563eb' }}>
          Total salaires : {fmt(totalSalaires)} €
        </div>
      </div>

      {/* Notes clients */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Notes clients reçues</div>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowAnnulees(!showAnnulees)}>
            {showAnnulees ? 'Masquer annulées' : 'Voir annulées'}
          </button>
        </div>
        {notesRecues.filter((n) => !n.annulee || showAnnulees).length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune note</div>
        )}
        {notesRecues.filter((n) => !n.annulee || showAnnulees).map((n) => (
          <div key={n.id} className="row-hover nota-row" style={{ opacity: n.annulee ? 0.5 : 1 }}>
            <span style={{ flex: 1, fontSize: 13 }}>
              {n.personne} → nous ({n.date ? n.date.substring(5, 7) + '/' + n.date.substring(2, 4) : ''})
              {n.annulee && <span style={{ marginLeft: 8, fontSize: 11, color: '#dc2626' }}>annulée</span>}
            </span>
            <span style={{ fontWeight: 600, color: n.montant < 0 ? '#dc2626' : '#16a34a' }}>{fmt(n.montant)} €</span>
            <button className="delete-btn" onClick={() => handleHideNote(n.id)}>✕</button>
          </div>
        ))}
        <div style={{ marginTop: 10, fontWeight: 700, color: totalNotes >= 0 ? '#16a34a' : '#dc2626' }}>
          Total notes : {fmt(totalNotes)} €
        </div>
      </div>

      {/* BOP */}
      <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
        <div className="card-title" style={{ color: '#dc2626' }}>Pour BOP</div>
        {bopFiches.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune entrée</div>}
        {bopFiches.map((f) => (
          <div key={f.id} className="row-hover nota-row">
            <span style={{ flex: 1, color: '#6b7280', fontSize: 13 }}>{fmtDate(f.date)}</span>
            <span style={{ fontWeight: 600, color: '#dc2626' }}>{fmt(f.montant)} €</span>
            <button className="delete-btn" onClick={() => handleDeleteFiche(f.id)}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="input-field"
            type="number"
            placeholder="Montant BOP..."
            value={bopInput}
            onChange={(e) => setBopInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBop()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-danger" onClick={handleAddBop}>+</button>
        </div>
        <div style={{ marginTop: 10, fontWeight: 700, color: '#dc2626' }}>
          Total BOP : {fmt(totalBop)} €
        </div>
        <div style={{ marginTop: 10, borderTop: '1px dashed #fca5a5', paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>BOP total (cumulatif) :</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input-field"
              type="number"
              placeholder={bopGlobal ? String(bopGlobal) : '0'}
              value={bopGlobalInput}
              onChange={(e) => setBopGlobalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setBopGlobal(key, parseFloat(bopGlobalInput)); setBopGlobalInput(''); load(); } }}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-danger"
              onClick={() => { setBopGlobal(key, parseFloat(bopGlobalInput)); setBopGlobalInput(''); load(); }}
            >✓</button>
          </div>
          {bopGlobal !== 0 && (
            <div style={{ marginTop: 6, fontWeight: 700, color: '#dc2626', fontSize: 13 }}>
              BOP total : {fmt(bopGlobal)} €
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
            <button className="delete-btn" onClick={() => handleDeleteFiche(f.id)}>✕</button>
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
          {fmt(totalSalaires)} (sal.) + {fmt(totalNotes)} (notes) - {fmt(totalBop)} (BOP) - {fmt(totalBk)} (BK)
          {dette !== 0 && ` + ${fmt(dette)} (report)`}
        </div>
      </div>
    </div>
  );
}
