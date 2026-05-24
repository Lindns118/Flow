import { useState, useEffect } from 'react';
import { getNotes, saveNotes, deleteNote, getHiddenNotes, hideMatchingPairs } from '../db';
import jsPDF from 'jspdf';

const normName = (s) => (s || '').toLowerCase().replace(/[\s\-_]+/g, '');

// Compute which notes form cancelling pairs (hidden or active partner)
function computePairHiddenIds(notes, hiddenIds) {
  const nonAnnulee = notes.filter((n) => !n.annulee);
  const hiddenActive = nonAnnulee.filter((n) => hiddenIds.has(n.id));
  const result = new Set();
  hiddenActive.forEach((n) => {
    if (result.has(n.id)) return;
    // Search among ALL non-annulee notes, not just hidden ones
    const pair = nonAnnulee.find(
      (m) =>
        m.id !== n.id &&
        !result.has(m.id) &&
        normName(m.personne) === normName(n.personne) &&
        m.destinataire_key === n.destinataire_key &&
        m.date === n.date &&
        Math.abs(Number(m.montant) + Number(n.montant)) < 0.001
    );
    if (pair) { result.add(n.id); result.add(pair.id); }
  });
  return result;
}

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

export default function NotesClients() {
  const [notes, setNotes] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [showAnnulees, setShowAnnulees] = useState({});
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [triPar, setTriPar] = useState('serveur');
  const [search, setSearch] = useState('');

  const load = () => {
    hideMatchingPairs();
    setNotes(getNotes());
    setHiddenIds(new Set(getHiddenNotes()));
  };
  useEffect(() => { load(); }, []);

  // Only notes that truly form cancelling pairs (not reset-hidden notes)
  const pairHiddenIds = computePairHiddenIds(notes, hiddenIds);

  const filteredNotes = notes.filter((n) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (n.personne || '').toLowerCase().includes(s)
      || (n.destinataire_nom || n.destinataire_key || '').toLowerCase().includes(s);
  });

  const grouped = filteredNotes.reduce((acc, n) => {
    const key = triPar === 'serveur'
      ? (n.destinataire_key || 'inconnu')
      : (n.personne?.toLowerCase().replace(/\s+/g, '_') || 'inconnu');
    const label = triPar === 'serveur'
      ? (n.destinataire_nom || n.destinataire_key || '?')
      : (n.personne || '?');
    if (!acc[key]) acc[key] = { nom: label, notes: [] };
    acc[key].notes.push(n);
    return acc;
  }, {});

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) =>
    a.nom.localeCompare(b.nom, 'fr')
  );

  const totalHiddenCount = pairHiddenIds.size;

  const handleDelete = (id) => { deleteNote(id); load(); };

  const handleEdit = (n) => {
    setEditId(n.id);
    setEditData({ personne: n.personne, montant: String(n.montant), date: n.date });
  };

  const [editError, setEditError] = useState('');

  const handleSaveEdit = () => {
    const montant = parseFloat(editData.montant);
    if (isNaN(montant)) { setEditError('Montant invalide'); return; }
    setEditError('');
    const allNotes = getNotes();
    const note = allNotes.find((n) => n.id === editId);
    if (note) {
      note.personne = editData.personne;
      note.montant = montant;
      note.date = editData.date;
      saveNotes(allNotes);
    }
    setEditId(null);
    setEditData({});
    load();
  };

  const toggleAnnulees = (key) => setShowAnnulees((prev) => ({ ...prev, [key]: !prev[key] }));

  // Export PDF global
  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 12;
    const cols = [
      { header: 'Date', w: 22 }, { header: 'Nom', w: 52 }, { header: 'Combien', w: 24 },
      { header: 'Serveur', w: 32 }, { header: 'Date', w: 20 }, { header: 'Serveur', w: 22 }, { header: 'OK', w: 8 },
    ];
    const rowH = 8;
    let y = 22;

    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('Notes Clients' + (search.trim() ? ` — "${search.trim()}"` : ''), margin, 12);
    doc.setFont(undefined, 'normal');

    const activeNotes = filteredNotes
      .filter((n) => !n.annulee && !pairHiddenIds.has(n.id))
      .sort((a, b) => (a.personne || '').localeCompare(b.personne || '', 'fr'));

    const drawRow = (cells, bold = false) => {
      let x = margin;
      doc.setFontSize(bold ? 8.5 : 8); doc.setFont(undefined, bold ? 'bold' : 'normal');
      cols.forEach((col, i) => {
        doc.rect(x, y, col.w, rowH);
        if (cells[i]) {
          let txt = String(cells[i]);
          while (doc.getTextWidth(txt) > col.w - 2 && txt.length > 1) txt = txt.slice(0, -1);
          doc.text(txt, x + 1.2, y + rowH - 2.2);
        }
        x += col.w;
      });
      y += rowH;
      if (y > 282) { doc.addPage(); y = 12; drawRow(cols.map((c) => c.header), true); }
    };

    drawRow(cols.map((c) => c.header), true);
    activeNotes.forEach((n) => {
      drawRow([fmtDate(n.date), n.personne || '', fmt(n.montant) + ' €', n.destinataire_nom || n.destinataire_key || '', '', '', '']);
    });
    doc.save('notes-clients.pdf');
  };

  // Export PDF groupé
  const exportPDFGroupe = (groupBy) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 12;
    const rowH = 7;
    let y = 20;

    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    const title = (groupBy === 'serveur' ? 'Notes par serveur' : 'Notes par client')
      + (search.trim() ? ` — "${search.trim()}"` : '');
    doc.text(title, margin, 12); doc.setFont(undefined, 'normal');

    const grp = {};
    filteredNotes.filter((n) => !n.annulee && !pairHiddenIds.has(n.id)).forEach((n) => {
      const k = groupBy === 'serveur'
        ? (n.destinataire_key || 'inconnu')
        : ((n.personne || '').toLowerCase().replace(/\s+/g, '_') || 'inconnu');
      const label = groupBy === 'serveur'
        ? (n.destinataire_nom || n.destinataire_key || '?')
        : (n.personne || '?');
      if (!grp[k]) grp[k] = { nom: label, notes: [] };
      grp[k].notes.push(n);
    });

    const groups = Object.values(grp).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const colLabel = groupBy === 'serveur' ? 'Client' : 'Serveur';
    const cols = [{ w: 65 }, { w: 28 }, { w: 35 }];

    const drawCell = (cx, cy, w, txt, bold) => {
      doc.rect(cx, cy, w, rowH);
      if (txt) {
        doc.setFont(undefined, bold ? 'bold' : 'normal');
        let t = String(txt);
        while (doc.getTextWidth(t) > w - 2 && t.length > 1) t = t.slice(0, -1);
        doc.text(t, cx + 1.2, cy + rowH - 1.8);
      }
    };

    groups.forEach((group) => {
      const total = group.notes.reduce((a, b) => a + b.montant, 0);
      if (y > 268) { doc.addPage(); y = 20; }
      doc.setFontSize(9); doc.setFont(undefined, 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(`${group.nom.toUpperCase()}`, margin, y);
      doc.setTextColor(total < 0 ? 220 : 22, total < 0 ? 38 : 163, total < 0 ? 38 : 74);
      doc.text(`${fmt(total)} €`, margin + 70, y);
      doc.setTextColor(0, 0, 0); y += 5;
      doc.setFontSize(7.5);
      let x = margin;
      [colLabel, 'Date', 'Montant'].forEach((h, i) => { drawCell(x, y, cols[i].w, h, true); x += cols[i].w; });
      y += rowH;
      [...group.notes].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((n) => {
        if (y > 278) { doc.addPage(); y = 20; }
        doc.setFontSize(7.5); x = margin;
        const row = groupBy === 'serveur'
          ? [n.personne || '', fmtDate(n.date), fmt(n.montant) + ' €']
          : [n.destinataire_nom || n.destinataire_key || '', fmtDate(n.date), fmt(n.montant) + ' €'];
        row.forEach((val, i) => { drawCell(x, y, cols[i].w, val, false); x += cols[i].w; });
        y += rowH;
      });
      doc.setFontSize(7.5); x = margin;
      ['Total', '', fmt(total) + ' €'].forEach((val, i) => { drawCell(x, y, cols[i].w, val, true); x += cols[i].w; });
      y += rowH + 6;
    });
    doc.save(`notes-${groupBy}.pdf`);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Notes clients</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={triPar === 'serveur' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setTriPar('serveur')}
          >Par serveur</button>
          <button
            className={triPar === 'client' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setTriPar('client')}
          >Par client</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 15 }}>🔍</span>
        <input
          className="input-field"
          placeholder="Rechercher client ou serveur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 32, width: '100%' }}
        />
      </div>

      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={exportPDF}>
          Export PDF global
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => exportPDFGroupe('serveur')}>
          Export par serveur
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => exportPDFGroupe('client')}>
          Export par client
        </button>
        {totalHiddenCount > 0 && (
          <button
            className={showHidden ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: 12, padding: '5px 12px', marginLeft: 'auto' }}
            onClick={() => setShowHidden((v) => !v)}
          >
            {showHidden ? 'Masquer cachées' : `Voir cachées (${totalHiddenCount})`}
          </button>
        )}
      </div>

      {sortedGroups.length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>
          {search ? 'Aucun résultat pour cette recherche' : 'Aucune note enregistrée'}
        </div>
      )}

      {sortedGroups.map(([key, group]) => {
        const activeNotes = group.notes.filter((n) => !n.annulee && !pairHiddenIds.has(n.id));
        // Only show pairs (notes hidden because they cancel each other), not reset-hidden notes
        const hiddenNotes = group.notes.filter((n) => !n.annulee && pairHiddenIds.has(n.id));
        const annuleesNotes = group.notes.filter((n) => n.annulee);
        const total = activeNotes.reduce((a, b) => a + b.montant, 0);
        const showAnn = showAnnulees[key];

        const sorted = (arr) => [...arr].sort((a, b) => (a.personne || '').localeCompare(b.personne || '', 'fr'));

        const renderNote = (n, isHidden = false) => (
          <div key={n.id}>
            {editId === n.id ? (
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px', gap: 8, marginBottom: 8 }}>
                  <input className="input-field" value={editData.personne}
                    onChange={(e) => setEditData({ ...editData, personne: e.target.value })} placeholder="Personne" />
                  <input className="input-field" type="number" value={editData.montant}
                    onChange={(e) => { setEditData({ ...editData, montant: e.target.value }); setEditError(''); }}
                    style={{ borderColor: editError ? '#ef4444' : undefined }} />
                  <input className="input-field" type="date" value={editData.date}
                    onChange={(e) => setEditData({ ...editData, date: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleSaveEdit}>✓</button>
                  <button className="btn btn-secondary" onClick={() => { setEditId(null); setEditData({}); setEditError(''); }}>Annuler</button>
                  {editError && <span style={{ color: '#ef4444', fontSize: 12 }}>{editError}</span>}
                </div>
              </div>
            ) : (
              <div
                className="nota-row"
                style={{ cursor: 'pointer', opacity: isHidden ? 0.45 : 1 }}
                onClick={() => !isHidden && handleEdit(n)}
              >
                <span style={{ flex: 1, fontSize: 13 }}>
                  {triPar === 'serveur'
                    ? <>{n.personne} <span style={{ color: '#9ca3af' }}>→ {group.nom}</span></>
                    : <>{group.nom} <span style={{ color: '#9ca3af' }}>→ {n.destinataire_nom}</span></>
                  }
                  {' '}({fmtDate(n.date)})
                </span>
                <span style={{ fontWeight: 600, color: n.montant < 0 ? '#dc2626' : '#16a34a' }}>
                  {fmt(n.montant)} €
                </span>
                <button
                  className="btn btn-danger"
                  style={{ marginLeft: 4, padding: '2px 8px', fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                >✕</button>
              </div>
            )}
          </div>
        );

        if (activeNotes.length === 0 && (!showHidden || hiddenNotes.length === 0) && annuleesNotes.length === 0) return null;

        return (
          <div key={key} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>{group.nom}</div>
                <div style={{ fontWeight: 700, color: total <= 0 ? '#dc2626' : '#16a34a', fontSize: 15 }}>
                  {fmt(total)} €
                </div>
                {hiddenNotes.length > 0 && (
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>({hiddenNotes.length} cachée{hiddenNotes.length > 1 ? 's' : ''})</span>
                )}
              </div>
              {annuleesNotes.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => toggleAnnulees(key)}
                >
                  {showAnn ? 'Masquer annulées' : `Annulées (${annuleesNotes.length})`}
                </button>
              )}
            </div>

            {activeNotes.length === 0 && !showHidden && (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune note active</div>
            )}

            {sorted(activeNotes).map((n) => renderNote(n, false))}

            {showHidden && hiddenNotes.length > 0 && (
              <div style={{ borderTop: '1px dashed #e5e7eb', marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>CACHÉES</div>
                {sorted(hiddenNotes).map((n) => renderNote(n, true))}
              </div>
            )}

            {showAnn && annuleesNotes.length > 0 && (
              <div style={{ borderTop: '1px dashed #e5e7eb', marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 6, fontWeight: 600 }}>ANNULÉES</div>
                {sorted(annuleesNotes).map((n) => (
                  <div key={n.id} className="nota-row" style={{ opacity: 0.5 }}>
                    <span style={{ flex: 1, fontSize: 13 }}>
                      {n.personne} → {n.destinataire_nom} ({fmtDate(n.date)})
                    </span>
                    <span style={{ fontWeight: 600, color: n.montant < 0 ? '#dc2626' : '#16a34a' }}>
                      {fmt(n.montant)} €
                    </span>
                    <button
                      className="btn btn-danger"
                      style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
