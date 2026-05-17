import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPersonnes, getFiches, getNotes, getHiddenNotes,
  deleteFiche, toggleNoteHidden, addFiche, addPersonne, slugify, resetServeur
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

  const load = () => {
    const personnes = getPersonnes();
    const p = personnes.find((p) => p.key === key);
    setPersonne(p || { key, nom: key });
    setFiches(getFiches());
    setNotes(getNotes());
    setHidden(getHiddenNotes());
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
  const totalGeneral = totalSalaires + totalNotes - totalBop - totalBk;

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
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text(personne?.nom || key, 14, y);
    y += 10;

    const section = (title, items, total, color) => {
      doc.setFontSize(12);
      doc.setTextColor(color || '#000000');
      doc.text(title, 14, y);
      y += 7;
      doc.setTextColor('#000000');
      doc.setFontSize(10);
      items.forEach((item) => {
        doc.text(`${fmtDate(item.date || '')}  ${fmt(item.montant)} €${item.personne ? '  ' + item.personne : ''}`, 18, y);
        y += 6;
      });
      doc.setFontSize(11);
      doc.text(`Total: ${fmt(total)} €`, 14, y);
      y += 10;
    };

    section('Salaires', salaires, totalSalaires);
    section('Notes clients reçues', notesRecues.filter(n => !n.annulee), totalNotes);
    section('BOP', bopFiches, totalBop, '#dc2626');
    section('BK', bkFiches, totalBk, '#ea580c');

    doc.setFontSize(13);
    doc.setTextColor('#1d4ed8');
    doc.text(`Total Général: ${fmt(totalGeneral)} €`, 14, y);

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
            <p>Toutes les fiches (salaires, BOP, BK) seront supprimées. Les notes resteront visibles dans Notes Clients mais plus sur cette fiche.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>Annuler</button>
              <button className="btn btn-danger" onClick={handleReset}>Réinitialiser</button>
            </div>
          </div>
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
          {fmt(totalSalaires)} (sal.) + {fmt(totalNotes)} (notes) − {fmt(totalBop)} (BOP) − {fmt(totalBk)} (BK)
        </div>
      </div>
    </div>
  );
}
