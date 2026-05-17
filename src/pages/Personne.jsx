import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFiches, deleteFiche, addFiche, getNotes, toggleNoteHidden, getHiddenNotes, getPersonnes } from '../db';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const fmt = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Personne() {
  const { key } = useParams();
  const [fiches, setFiches] = useState([]);
  const [notes, setNotes] = useState([]);
  const [hidden, setHidden] = useState([]);
  const [showAnnulees, setShowAnnulees] = useState(false);
  const [bopInput, setBopInput] = useState('');
  const [bkInput, setBkInput] = useState('');
  const [nom, setNom] = useState('');

  const load = () => {
    const allFiches = getFiches().filter((f) => f.personne_key === key);
    setFiches(allFiches);
    const allNotes = getNotes().filter((n) => n.destinataire_key === key);
    setNotes(allNotes);
    setHidden(getHiddenNotes());
    const personnes = getPersonnes();
    const p = personnes.find((p) => p.key === key);
    setNom(p ? p.nom : key);
  };

  useEffect(() => { load(); }, [key]);

  const salaires = fiches.filter((f) => f.type === 'salaire');
  const bops = fiches.filter((f) => f.type === 'bop');
  const bks = fiches.filter((f) => f.type === 'bk');

  const totalSalaires = salaires.reduce((a, f) => a + f.montant, 0);
  const visibleNotes = notes.filter((n) => !n.annulee && !hidden.includes(n.id));
  const annuleesNotes = notes.filter((n) => n.annulee);
  const totalNotes = visibleNotes.reduce((a, n) => a + n.montant, 0);
  const totalBop = bops.reduce((a, f) => a + f.montant, 0);
  const totalBk = bks.reduce((a, f) => a + f.montant, 0);
  const totalGeneral = totalSalaires + totalNotes - totalBop - totalBk;

  const addBop = (e) => {
    if (e.key && e.key !== 'Enter') return;
    if (!bopInput) return;
    addFiche(key, nom, new Date().toISOString().split('T')[0], parseFloat(bopInput), 'bop');
    setBopInput('');
    load();
  };

  const addBk = (e) => {
    if (e.key && e.key !== 'Enter') return;
    if (!bkInput) return;
    addFiche(key, nom, new Date().toISOString().split('T')[0], parseFloat(bkInput), 'bk');
    setBkInput('');
    load();
  };

  const handleHideNote = (id) => {
    toggleNoteHidden(id);
    setHidden(getHiddenNotes());
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text(`Fiche de ${nom}`, 14, y); y += 12;

    doc.setFontSize(12);
    doc.text('Salaires', 14, y); y += 8;
    salaires.forEach((f) => { doc.setFontSize(10); doc.text(`${f.date}  ${fmt(f.montant)}`, 18, y); y += 6; });
    doc.text(`Total salaires: ${fmt(totalSalaires)}`, 14, y); y += 10;

    doc.setFontSize(12);
    doc.text('Notes clients', 14, y); y += 8;
    visibleNotes.forEach((n) => { doc.setFontSize(10); doc.text(`${n.personne}  ${n.date}  ${fmt(n.montant)}`, 18, y); y += 6; });
    doc.text(`Total notes: ${fmt(totalNotes)}`, 14, y); y += 10;

    doc.setFontSize(12);
    doc.text('BOP', 14, y); y += 8;
    bops.forEach((f) => { doc.setFontSize(10); doc.text(`${f.date}  ${fmt(f.montant)}`, 18, y); y += 6; });
    doc.text(`Total BOP: ${fmt(totalBop)}`, 14, y); y += 10;

    doc.text('BK', 14, y); y += 8;
    bks.forEach((f) => { doc.setFontSize(10); doc.text(`${f.date}  ${fmt(f.montant)}`, 18, y); y += 6; });
    doc.text(`Total BK: ${fmt(totalBk)}`, 14, y); y += 10;

    doc.setFontSize(13);
    doc.text(`TOTAL GÉNÉRAL: ${fmt(totalGeneral)}`, 14, y);
    doc.save(`fiche_${key}.pdf`);
  };

  const exportWord = async () => {
    const rows = [];
    const max = Math.max(salaires.length, visibleNotes.length, bops.length, bks.length);
    for (let i = 0; i < max; i++) {
      const s = salaires[i];
      const n = visibleNotes[i];
      const b = bops[i];
      const bk = bks[i];
      rows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(s ? s.date : '')] }),
          new TableCell({ children: [new Paragraph(s ? fmt(s.montant) : '')] }),
          new TableCell({ children: [new Paragraph(n ? n.personne : '')] }),
          new TableCell({ children: [new Paragraph(n ? fmt(n.montant) : '')] }),
          new TableCell({ children: [new Paragraph(b ? fmt(b.montant) : '')] }),
          new TableCell({ children: [new Paragraph(bk ? fmt(bk.montant) : '')] }),
        ],
      }));
    }
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Total', bold: true })] })] }),
        new TableCell({ children: [new Paragraph(fmt(totalSalaires))] }),
        new TableCell({ children: [new Paragraph('')] }),
        new TableCell({ children: [new Paragraph(fmt(totalNotes))] }),
        new TableCell({ children: [new Paragraph(fmt(totalBop))] }),
        new TableCell({ children: [new Paragraph(fmt(totalBk))] }),
      ],
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: `Fiche de ${nom}`, bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
          new Paragraph(''),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ['Date salaire', 'Montant', 'Personne note', 'Montant note', 'BOP', 'BK'].map(
                  (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })
                ),
              }),
              ...rows,
            ],
          }),
          new Paragraph(''),
          new Paragraph({ children: [new TextRun({ text: `TOTAL GÉNÉRAL: ${fmt(totalGeneral)}`, bold: true, size: 24 })] }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `fiche_${key}.docx`);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{nom}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="outline-btn" onClick={exportPDF}>Export PDF</button>
          <button className="outline-btn" onClick={exportWord}>Export Word</button>
          <Link to="/personnes" className="outline-btn" style={{ textDecoration: 'none' }}>← Retour</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Salaires */}
        <div className="card">
          <h2 className="section-title">SALAIRES</h2>
          {salaires.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>Aucun salaire</p>}
          {salaires.map((f) => (
            <div key={f.id} className="list-row">
              <span>{f.date}</span>
              <span>{fmt(f.montant)}</span>
              <button className="delete-btn" onClick={() => { deleteFiche(f.id); load(); }}>✕</button>
            </div>
          ))}
          <div className="total-small">Total salaires: <strong>{fmt(totalSalaires)}</strong></div>
        </div>

        {/* Notes clients */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="section-title" style={{ margin: 0 }}>NOTES CLIENTS</h2>
            <button className="outline-btn small" onClick={() => setShowAnnulees(!showAnnulees)}>
              {showAnnulees ? 'Masquer annulées' : 'Voir annulées'}
            </button>
          </div>
          {visibleNotes.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>Aucune note</p>}
          {visibleNotes.map((n) => (
            <div key={n.id} className="list-row">
              <span style={{ fontSize: 13 }}>{n.personne} ({n.date})</span>
              <span style={{ color: n.montant < 0 ? '#ef4444' : '#22c55e' }}>{fmt(n.montant)}</span>
              <button className="delete-btn" onClick={() => handleHideNote(n.id)}>✕</button>
            </div>
          ))}
          {showAnnulees && annuleesNotes.map((n) => (
            <div key={n.id} className="list-row" style={{ opacity: 0.4 }}>
              <span style={{ fontSize: 13 }}>{n.personne} ({n.date}) [annulée]</span>
              <span>{fmt(n.montant)}</span>
            </div>
          ))}
          <div className="total-small" style={{ color: totalNotes < 0 ? '#ef4444' : '#22c55e' }}>
            Total notes: <strong>{fmt(totalNotes)}</strong>
          </div>
        </div>

        {/* BOP */}
        <div className="card">
          <h2 className="section-title" style={{ color: '#ef4444' }}>POUR BOP</h2>
          {bops.map((f) => (
            <div key={f.id} className="list-row">
              <span>{f.date}</span>
              <span style={{ color: '#ef4444' }}>{fmt(f.montant)}</span>
              <button className="delete-btn" onClick={() => { deleteFiche(f.id); load(); }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input className="input" style={{ flex: 1 }} type="number" placeholder="Montant" value={bopInput}
              onChange={(e) => setBopInput(e.target.value)}
              onKeyDown={addBop} />
            <button className="save-btn" style={{ background: '#ef4444' }} onClick={() => addBop({})}>+</button>
          </div>
          <div className="total-small" style={{ color: '#ef4444' }}>Total BOP: <strong>{fmt(totalBop)}</strong></div>
        </div>

        {/* BK */}
        <div className="card">
          <h2 className="section-title" style={{ color: '#f97316' }}>POUR BK</h2>
          {bks.map((f) => (
            <div key={f.id} className="list-row">
              <span>{f.date}</span>
              <span style={{ color: '#f97316' }}>{fmt(f.montant)}</span>
              <button className="delete-btn" onClick={() => { deleteFiche(f.id); load(); }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input className="input" style={{ flex: 1 }} type="number" placeholder="Montant" value={bkInput}
              onChange={(e) => setBkInput(e.target.value)}
              onKeyDown={addBk} />
            <button className="save-btn" style={{ background: '#f97316' }} onClick={() => addBk({})}>+</button>
          </div>
          <div className="total-small" style={{ color: '#f97316' }}>Total BK: <strong>{fmt(totalBk)}</strong></div>
        </div>
      </div>

      {/* Total général */}
      <div className="total-bar" style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>TOTAL GÉNÉRAL</div>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{fmt(totalGeneral)}</div>
      </div>
    </div>
  );
}
