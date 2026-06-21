import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFiches, getFichesPierre } from '../db';
import jsPDF from 'jspdf';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

// BOP is stored positive but represents a deduction — negate for display/calc
const effectif = (f) => f.type === 'bop' ? -f.montant : f.montant;

export default function Salaires() {
  const [fiches, setFiches] = useState([]);
  const [bkByKey, setBkByKey] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const allRegular = getFiches();
    const regular = allRegular.filter((f) => f.type === 'salaire' || f.type === 'bop');
    const pierre = getFichesPierre()
      .filter((f) => f.type === 'salaire')
      .map((f) => ({ ...f, personne_key: 'pierre', personne_nom: 'Pierre' }));
    setFiches([...regular, ...pierre].sort((a, b) => b.date.localeCompare(a.date)));

    // BK per server (regular servers)
    const bk = {};
    allRegular.filter((f) => f.type === 'bk').forEach((f) => {
      bk[f.personne_key] = (bk[f.personne_key] || 0) + f.montant;
    });
    // BK for Pierre
    const pierrebk = getFichesPierre().filter((f) => f.type === 'bk').reduce((a, b) => a + b.montant, 0);
    if (pierrebk) bk['pierre'] = pierrebk;
    setBkByKey(bk);
  }, []);

  const byDate = fiches.reduce((acc, f) => {
    if (!acc[f.date]) acc[f.date] = { date: f.date, entries: [], total: 0 };
    acc[f.date].entries.push(f);
    acc[f.date].total += effectif(f);
    return acc;
  }, {});

  const days = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  const grandTotal = fiches.reduce((a, f) => a + effectif(f), 0);

  const byServeur = fiches.reduce((acc, f) => {
    if (!acc[f.personne_key]) acc[f.personne_key] = { key: f.personne_key, nom: f.personne_nom, salaire: 0, bop: 0 };
    if (f.type === 'bop') acc[f.personne_key].bop += f.montant;
    else acc[f.personne_key].salaire += f.montant;
    return acc;
  }, {});
  const serveurs = Object.values(byServeur).sort((a, b) => (b.salaire - b.bop) - (a.salaire - a.bop));

  const goToFiche = (key) => key === 'pierre' ? navigate('/pierre') : navigate(`/personne/${key}`);

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
      doc.setFontSize(8); doc.setFont(undefined, 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, totalW, rowH, 'F');
      doc.text(fmtDate(day.date), margin + 1.2, y + rowH - 2);
      doc.text(fmt(day.total) + ' €', margin + totalW - 31, y + rowH - 2);
      y += rowH;
      if (y > 280) { doc.addPage(); y = 12; drawRow(cols.map((c) => c.header), true); }
      doc.setFont(undefined, 'normal');
      day.entries.forEach((f) => {
        const sign = f.type === 'bop' ? '-' : '';
        drawRow(['', f.personne_nom, f.heures ? f.heures + 'h' : (f.type === 'bop' ? 'BOP' : ''), sign + fmt(f.montant) + ' €']);
      });
    });
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

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Colonne gauche : jours */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {days.length === 0 && (
            <div className="card" style={{ color: '#9ca3af' }}>Aucun salaire enregistré</div>
          )}
          {days.map((day) => (
            <div key={day.date} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{fmtDate(day.date)}</div>
                <div style={{ fontWeight: 700, color: day.total < 0 ? '#dc2626' : '#2563eb', fontSize: 14 }}>{fmt(day.total)} €</div>
              </div>
              {[...day.entries].sort((a, b) => (a.personne_nom || '').localeCompare(b.personne_nom || '', 'fr')).map((f) => {
                const val = effectif(f);
                return (
                  <div key={f.id} className="nota-row">
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{f.personne_nom}</span>
                    {f.heures ? <span style={{ color: '#6b7280', fontSize: 12, marginRight: 8 }}>{f.heures}h</span> : null}
                    {f.type === 'bop' && <span style={{ fontSize: 11, color: '#7c3aed', marginRight: 6, fontWeight: 600 }}>BOP</span>}
                    <span style={{ fontWeight: 600, color: val < 0 ? '#dc2626' : '#16a34a' }}>
                      {val < 0 ? '-' : ''}{fmt(Math.abs(val))} €
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Colonne droite : totaux par serveur */}
        {serveurs.length > 0 && (
          <div style={{ width: 220, flexShrink: 0 }}>
            <div className="card" style={{ position: 'sticky', top: 12 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>Par serveur</div>
              {serveurs.map((s) => {
                const net = s.salaire - s.bop;
                const bk = bkByKey[s.key] || 0;
                const final = net - bk;
                return (
                  <div key={s.key} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 8, marginBottom: 8 }}>
                    <div
                      onClick={() => goToFiche(s.key)}
                      style={{ cursor: 'pointer', marginBottom: 4 }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{s.nom}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 1 }}>
                      <span style={{ color: '#6b7280' }}>Salaire</span>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(s.salaire)} €</span>
                    </div>
                    {s.bop > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 1 }}>
                        <span style={{ color: '#7c3aed' }}>− BOP</span>
                        <span style={{ color: '#7c3aed', fontWeight: 600 }}>{fmt(s.bop)} €</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: '#dc2626' }}>− BK</span>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>{fmt(bk)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid #e5e7eb', paddingTop: 3 }}>
                      <span style={{ fontWeight: 700 }}>Net</span>
                      <span style={{ fontWeight: 700, color: final < 0 ? '#dc2626' : '#1f2937' }}>{fmt(final)} €</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 8, borderTop: '2px solid #e5e7eb' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total net</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{fmt(grandTotal)} €</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
