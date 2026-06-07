import { useState, useEffect } from 'react';
import { getFiches, getFichesPierre } from '../db';
import jsPDF from 'jspdf';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

export default function Salaires() {
  const [fiches, setFiches] = useState([]);

  useEffect(() => {
    const regular = getFiches().filter((f) => f.type === 'salaire' || f.type === 'bop');
    const pierre = getFichesPierre()
      .filter((f) => f.type === 'salaire')
      .map((f) => ({ ...f, personne_key: 'pierre', personne_nom: 'Pierre' }));
    setFiches([...regular, ...pierre].sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  const byDate = fiches.reduce((acc, f) => {
    if (!acc[f.date]) acc[f.date] = { date: f.date, entries: [], total: 0 };
    acc[f.date].entries.push(f);
    acc[f.date].total += f.montant;
    return acc;
  }, {});

  const days = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  const grandTotal = fiches.reduce((a, b) => a + b.montant, 0);

  // Group by server for summary
  const byServeur = fiches.reduce((acc, f) => {
    if (!acc[f.personne_key]) acc[f.personne_key] = { nom: f.personne_nom, total: 0 };
    acc[f.personne_key].total += f.montant;
    return acc;
  }, {});
  const serveurs = Object.values(byServeur).sort((a, b) => b.total - a.total);

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 12;
    const rowH = 7;
    let y = 20;

    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('Salaires — session active', margin, 12);
    doc.setFont(undefined, 'normal');

    const cols = [{ header: 'Date', w: 28 }, { header: 'Serveur', w: 50 }, { header: 'H', w: 16 }, { header: 'Montant', w: 30 }];
    const totalW = cols.reduce((a, c) => a + c.w, 0);

    const drawRow = (cells, bold = false) => {
      let x = margin;
      doc.setFontSize(bold ? 8.5 : 8); doc.setFont(undefined, bold ? 'bold' : 'normal');
      cols.forEach((col, i) => {
        doc.rect(x, y, col.w, rowH);
        if (cells[i]) {
          let txt = String(cells[i]);
          while (doc.getTextWidth(txt) > col.w - 2 && txt.length > 1) txt = txt.slice(0, -1);
          doc.text(txt, x + 1.2, y + rowH - 2);
        }
        x += col.w;
      });
      y += rowH;
      if (y > 280) { doc.addPage(); y = 12; drawRow(cols.map((c) => c.header), true); }
    };

    drawRow(cols.map((c) => c.header), true);

    days.forEach((day) => {
      // Day header
      doc.setFontSize(8); doc.setFont(undefined, 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, totalW, rowH, 'F');
      doc.text(fmtDate(day.date), margin + 1.2, y + rowH - 2);
      doc.text(fmt(day.total) + ' €', margin + totalW - 31, y + rowH - 2);
      y += rowH;
      if (y > 280) { doc.addPage(); y = 12; drawRow(cols.map((c) => c.header), true); }

      doc.setFont(undefined, 'normal');
      day.entries.forEach((f) => {
        drawRow(['', f.personne_nom, f.heures ? f.heures + 'h' : '', fmt(f.montant) + ' €']);
      });
    });

    // Total
    doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text(`Total général : ${fmt(grandTotal)} €`, margin, y + 6);

    doc.save('salaires.pdf');
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Salaires</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="blue-total" style={{ padding: '8px 16px', fontSize: 15 }}>
            Total : {fmt(grandTotal)} €
          </div>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={exportPDF}>
            Export PDF
          </button>
        </div>
      </div>

      {/* Résumé par serveur */}
      {serveurs.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Résumé par serveur</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {serveurs.map((s) => (
              <div key={s.nom} style={{
                background: '#f0f9ff', borderRadius: 8, padding: '6px 14px',
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{s.nom}</span>
                <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 13 }}>{fmt(s.total)} €</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {days.length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>Aucun salaire enregistré</div>
      )}

      {days.map((day) => (
        <div key={day.date} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{fmtDate(day.date)}</div>
            <div style={{ fontWeight: 700, color: '#2563eb', fontSize: 14 }}>{fmt(day.total)} €</div>
          </div>
          {[...day.entries].sort((a, b) => (a.personne_nom || '').localeCompare(b.personne_nom || '', 'fr')).map((f) => (
            <div key={f.id} className="nota-row">
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{f.personne_nom}</span>
              {f.heures ? <span style={{ color: '#6b7280', fontSize: 12, marginRight: 8 }}>{f.heures}h</span> : null}
              {f.type === 'bop' && <span style={{ fontSize: 11, color: '#7c3aed', marginRight: 6, fontWeight: 600 }}>BOP</span>}
              <span style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(f.montant)} €</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
