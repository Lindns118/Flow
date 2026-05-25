import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { addFiche, addPersonne, addNote, getNotes, rembourserNote, getPersonnes, addFichePierre, slugify, addPret } from '../db';

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MULTIPLIERS = [0.14, 0.16, 0.22];

export default function Calculator() {
  const [baseValues, setBaseValues] = useState(['', '', '']);
  const [diviseur, setDiviseur] = useState('');
  const [personRows, setPersonRows] = useState([
    { key: '', nom: '', date: today(), valeur: '', isNew: false },
    { key: '', nom: '', date: today(), valeur: '', isNew: false },
    { key: '', nom: '', date: today(), valeur: '', isNew: false },
  ]);
  const [noteLines, setNoteLines] = useState([
    { personne: '', montant: '', destinataire: '', date: today() },
  ]);
  const [sessionNotes, setSessionNotes] = useState([]);
  const [pierreHeures, setPierreHeures] = useState('');
  const [pierreDate, setPierreDate] = useState(today());
  const [personnesList, setPersonnesList] = useState([]);
  const [saveMsg, setSaveMsg] = useState('');
  const [rowMsgs, setRowMsgs] = useState({});
  const [pretForm, setPretForm] = useState({ type: 'emprunt', produit: '', nombre: '1', lieu: '', date: today() });
  const [sessionPrets, setSessionPrets] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [rembLines, setRembLines] = useState([
    { search: '', showDropdown: false, selectedNote: null, date: today() },
  ]);

  useEffect(() => {
    setPersonnesList(getPersonnes());
    setAllNotes(getNotes());
  }, []);

  const results = baseValues.map((v, i) => (parseFloat(v) || 0) * MULTIPLIERS[i]);
  const totalBase = results.reduce((a, b) => a + b, 0);
  const totalSommes = results.reduce((a, b) => a + b, 0);
  const H = diviseur && parseFloat(diviseur) !== 0
    ? totalSommes / parseFloat(diviseur)
    : totalBase;

  const personneResults = personRows.map((p) => (parseFloat(p.valeur) || 0) * H);
  const totalPersonnes = personneResults.reduce((a, b) => a + b, 0);

  const flashMsg = (msg) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 2500); };
  const flashRowMsg = (i, msg) => {
    setRowMsgs((prev) => ({ ...prev, [i]: msg }));
    setTimeout(() => setRowMsgs((prev) => { const n = { ...prev }; delete n[i]; return n; }), 2500);
  };

  const handleSavePret = () => {
    if (!pretForm.produit || !pretForm.lieu) return;
    addPret(pretForm);
    setSessionPrets((prev) => [{ ...pretForm, id: Date.now() }, ...prev]);
    flashMsg(`✓ ${pretForm.type === 'emprunt' ? 'Emprunt' : 'Prêt'} enregistré`);
    setPretForm({ type: pretForm.type, produit: '', nombre: '1', lieu: '', date: today() });
  };

  const handleSaveFiche = (i) => {
    const p = personRows[i];
    const nom = p.isNew ? p.nom : p.nom;
    if (!nom || !p.date) return;
    // Pierre a son propre système de fiches — ne pas l'ajouter aux serveurs normaux
    if (p.key === 'pierre' || slugify(nom) === 'pierre') {
      addFichePierre({ date: p.date, heures: parseFloat(p.valeur) || 0, type: 'salaire' });
      flashRowMsg(i, '✓ Fiche Pierre sauvegardée');
      return;
    }
    const personne = addPersonne(nom);
    addFiche(personne.key, personne.nom, p.date, personneResults[i], 'salaire');
    setPersonnesList(getPersonnes());
    flashRowMsg(i, `✓ Sauvegardé: ${personne.nom}`);
  };

  const handleSaveNote = (i) => {
    const line = noteLines[i];
    if (!line.personne || !line.montant || !line.destinataire) return;
    const dest = line.destinataire === 'pierre'
      ? { key: 'pierre', nom: 'Pierre' }
      : personnesList.find((p) => p.key === line.destinataire) || { key: line.destinataire, nom: line.destinataire };
    const montant = -Math.abs(parseFloat(line.montant));
    const note = addNote({
      personne: line.personne,
      montant,
      destinataire_key: dest.key,
      destinataire_nom: dest.nom,
      date: line.date || today(),
    });
    setSessionNotes((prev) => [note, ...prev]);
    flashMsg('✓ Note enregistrée');
  };

  const addNoteLine = () => {
    setNoteLines([...noteLines, { personne: '', montant: '', destinataire: '', date: today() }]);
  };

  const getActiveNotesSuggestions = (search) => {
    const activeNotes = allNotes.filter((n) => !n.annulee);
    if (!search.trim()) return activeNotes.slice(-6).reverse();
    const q = search.toLowerCase();
    return activeNotes.filter(
      (n) => n.personne?.toLowerCase().includes(q) || n.destinataire_nom?.toLowerCase().includes(q)
    );
  };

  const handleRembSearch = (i, value) => {
    setRembLines((prev) => { const u = [...prev]; u[i] = { ...u[i], search: value, showDropdown: true, selectedNote: null }; return u; });
  };
  const handleRembFocus = (i) => {
    setRembLines((prev) => { const u = [...prev]; u[i] = { ...u[i], showDropdown: true }; return u; });
  };
  const closeRembDropdown = (i) => {
    setRembLines((prev) => { const u = [...prev]; u[i] = { ...u[i], showDropdown: false }; return u; });
  };
  const handleRembSelect = (i, note) => {
    setRembLines((prev) => {
      const u = [...prev];
      u[i] = { ...u[i], search: `${note.personne} → ${note.destinataire_nom} (${fmt(note.montant)} €)`, showDropdown: false, selectedNote: note };
      return u;
    });
  };
  const updateRembLine = (i, field, val) => {
    setRembLines((prev) => { const u = [...prev]; u[i] = { ...u[i], [field]: val }; return u; });
  };
  const addRembLine = () => {
    setRembLines((prev) => [...prev, { search: '', showDropdown: false, selectedNote: null, date: today() }]);
  };
  const handleSaveRemb = (i) => {
    const line = rembLines[i];
    if (!line.selectedNote) return;
    rembourserNote(line.selectedNote.id, line.date);
    setAllNotes(getNotes());
    setRembLines((prev) => { const u = [...prev]; u[i] = { search: '', showDropdown: false, selectedNote: null, date: today() }; return u; });
    flashMsg('✓ Note remboursée');
  };

  const addPersonRow = () => {
    setPersonRows([...personRows, { key: '', nom: '', date: today(), valeur: '', isNew: false }]);
  };

  const removePersonRow = (i) => {
    setPersonRows(personRows.filter((_, idx) => idx !== i));
  };

  const serverOptions = [
    { key: 'pierre', nom: 'Pierre' },
    ...personnesList.filter((p) => p.key !== 'pierre'),
  ];

  const updateNote = (i, field, val) => {
    const updated = [...noteLines];
    updated[i] = { ...updated[i], [field]: val };
    setNoteLines(updated);
  };

  const updatePersonRow = (i, field, val) => {
    const updated = [...personRows];
    updated[i] = { ...updated[i], [field]: val };
    setPersonRows(updated);
  };

  const handleSavePierre = () => {
    if (!pierreHeures) return;
    addFichePierre({ date: pierreDate, heures: pierreHeures, notes: '' });
    flashMsg('✓ Fiche Pierre sauvegardée');
    setPierreHeures('');
  };

  const destOptions = [
    { key: 'pierre', nom: 'Pierre' },
    ...personnesList.filter((p) => p.key !== 'pierre'),
  ];

  const allServers = [
    { key: 'pierre', nom: 'Pierre' },
    ...personnesList.filter((p) => p.key !== 'pierre'),
  ];

  return (
    <div className="page-container">
      {/* Sticky top bar: back + servers */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        margin: '0 -16px 16px', padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <Link
          to="/"
          style={{
            fontSize: 13, color: '#6b7280', textDecoration: 'none',
            padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db',
            whiteSpace: 'nowrap', fontWeight: 600,
          }}
        >← Accueil</Link>
        <div style={{ width: 1, height: 20, background: '#e5e7eb', flexShrink: 0 }} />
        {allServers.map((s) => (
          <Link
            key={s.key}
            to={s.key === 'pierre' ? '/pierre' : `/personne/${s.key}`}
            style={{
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              padding: '4px 12px', borderRadius: 20,
              background: '#eff6ff', color: '#2563eb',
              border: '1px solid #bfdbfe', whiteSpace: 'nowrap',
            }}
          >
            {s.nom}
          </Link>
        ))}
      </div>

      {saveMsg && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {saveMsg}
        </div>
      )}

      {/* Valeurs de base */}
      <div className="card">
        <div className="card-title">Valeurs de base</div>
        {MULTIPLIERS.map((mult, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px 140px', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>LIGNE {i + 1} × {mult}</div>
            <input
              className="input-field"
              type="number"
              value={baseValues[i]}
              placeholder="0"
              onChange={(e) => { const v = [...baseValues]; v[i] = e.target.value; setBaseValues(v); }}
            />
            <div className="label-sm" style={{ textAlign: 'right' }}>Résultat</div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16 }}>{fmt(results[i])}</div>
          </div>
        ))}
        <div className="blue-total">TOTAL BASE : {fmt(totalBase)} €</div>
      </div>

      {/* Sommes */}
      <div className="card">
        <div className="card-title">Sommes</div>
        <div className="three-col" style={{ marginBottom: 14 }}>
          {MULTIPLIERS.map((mult, i) => (
            <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <div className="label-sm">× {mult}</div>
              <div style={{ fontWeight: 700, fontSize: 20, marginTop: 4 }}>{fmt(results[i])}</div>
            </div>
          ))}
        </div>
        <div className="blue-total" style={{ marginBottom: 14 }}>TOTAL SOMMES : {fmt(totalSommes)} €</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="label-sm" style={{ width: 120 }}>DIVISEUR (÷)</div>
          <input
            className="input-field"
            type="number"
            placeholder="Facultatif"
            value={diviseur}
            onChange={(e) => setDiviseur(e.target.value)}
            style={{ width: 160 }}
          />
          <div style={{ fontWeight: 700, fontSize: 16, color: '#2563eb' }}>H = {fmt(H)}</div>
        </div>
      </div>

      {/* Personnes × H  +  Notes clients */}
      <div className="two-col">
        {/* Personnes */}
        <div className="card">
          <div className="card-title">Personnes × H</div>
          {personRows.map((p, i) => (
            <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < personRows.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px 36px 28px', gap: 8, alignItems: 'end' }}>
                <div>
                  <div className="label-sm">Serveur</div>
                  {p.isNew ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        className="input-field"
                        placeholder="Nouveau nom..."
                        value={p.nom}
                        autoFocus
                        onChange={(e) => {
                          const updated = [...personRows];
                          updated[i] = { ...updated[i], nom: e.target.value, key: slugify(e.target.value) };
                          setPersonRows(updated);
                        }}
                        style={{ flex: 1 }}
                      />
                      <button
                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '0 6px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}
                        onClick={() => { const u = [...personRows]; u[i] = { ...u[i], isNew: false, nom: '', key: '' }; setPersonRows(u); }}
                        title="Annuler"
                      >◀</button>
                    </div>
                  ) : (
                    <select
                      className="input-field"
                      value={p.key}
                      onChange={(e) => {
                        if (e.target.value === '__nouveau__') {
                          const u = [...personRows]; u[i] = { ...u[i], isNew: true, key: '', nom: '' }; setPersonRows(u);
                        } else {
                          const found = serverOptions.find((s) => s.key === e.target.value);
                          const u = [...personRows]; u[i] = { ...u[i], key: e.target.value, nom: found?.nom || '' }; setPersonRows(u);
                        }
                      }}
                    >
                      <option value="">— Choisir —</option>
                      {serverOptions.map((s) => (
                        <option key={s.key} value={s.key}>{s.nom}</option>
                      ))}
                      <option value="__nouveau__">+ Nouveau serveur...</option>
                    </select>
                  )}
                </div>
                <div>
                  <div className="label-sm">Date</div>
                  <input className="input-field" type="date" value={p.date}
                    onChange={(e) => updatePersonRow(i, 'date', e.target.value)} />
                </div>
                <div>
                  <div className="label-sm">Valeur</div>
                  <input className="input-field" type="number" placeholder="0" value={p.valeur}
                    onChange={(e) => updatePersonRow(i, 'valeur', e.target.value)} />
                </div>
                <button className="btn btn-primary" style={{ padding: '8px 6px' }} onClick={() => handleSaveFiche(i)} title="Sauvegarder">💾</button>
                <button className="btn btn-danger" style={{ padding: '8px 4px', fontSize: 12 }} onClick={() => removePersonRow(i)} title="Supprimer">✕</button>
              </div>
              <div style={{ marginTop: 6, textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
                {p.nom && <strong style={{ color: '#374151', marginRight: 6 }}>{p.nom}</strong>}
                {fmt(parseFloat(p.valeur) || 0)} × H({fmt(H)}) = <strong>{fmt(personneResults[i])}</strong>
              </div>
              {rowMsgs[i] && (
                <div style={{ marginTop: 4, textAlign: 'right', fontSize: 12, color: '#065f46', background: '#d1fae5', borderRadius: 6, padding: '3px 10px' }}>
                  {rowMsgs[i]}
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-secondary" onClick={addPersonRow} style={{ marginBottom: 12 }}>+ Ajouter une personne</button>
          <div className="blue-total">TOTAL PERSONNES : {fmt(totalPersonnes)} €</div>
        </div>

        {/* Notes clients */}
        <div className="card">
          <div className="card-title">Notes clients</div>
          {noteLines.map((line, i) => (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < noteLines.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>
                <div>
                  <div className="label-sm">Personne</div>
                  <input className="input-field" placeholder="Nom" value={line.personne}
                    onChange={(e) => updateNote(i, 'personne', e.target.value)} />
                </div>
                <div>
                  <div className="label-sm">Montant</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 16 }}>−</span>
                    <input className="input-field" type="number" placeholder="0" value={line.montant}
                      onChange={(e) => updateNote(i, 'montant', e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px', gap: 8, alignItems: 'end' }}>
                <div>
                  <div className="label-sm">Pour qui</div>
                  <select className="input-field" value={line.destinataire} onChange={(e) => updateNote(i, 'destinataire', e.target.value)}>
                    <option value="">— Choisir —</option>
                    {destOptions.map((d) => (
                      <option key={d.key} value={d.key}>{d.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="label-sm">Date</div>
                  <input className="input-field" type="date" value={line.date}
                    onChange={(e) => updateNote(i, 'date', e.target.value)} />
                </div>
                <button className="btn btn-primary" style={{ padding: '8px 6px' }} onClick={() => handleSaveNote(i)} title="Sauvegarder">💾</button>
              </div>
            </div>
          ))}
          <button className="btn btn-secondary" onClick={addNoteLine} style={{ marginBottom: 14 }}>+ Ajouter une ligne</button>

          {sessionNotes.length > 0 && (
            <div style={{ background: '#f0f9ff', padding: '10px', borderRadius: 8, marginBottom: 14 }}>
              <div className="label-sm" style={{ marginBottom: 6 }}>NOTES ENREGISTRÉES (SESSION)</div>
              {sessionNotes.map((n) => (
                <div key={n.id} className="nota-row">
                  <span style={{ flex: 1 }}>
                    {n.personne} → {n.destinataire_nom} ({n.date ? n.date.substring(5, 7) + '/' + n.date.substring(2, 4) : ''})
                  </span>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>
                    {fmt(n.montant)} €
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="section-divider" />

          {/* Remboursement note */}
          <div className="card-title" style={{ marginBottom: 8, color: '#dc2626', fontSize: 12 }}>REMBOURSEMENT NOTE</div>
          {rembLines.map((line, i) => (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < rembLines.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px', gap: 8, alignItems: 'end' }}>
                <div style={{ position: 'relative' }}>
                  <div className="label-sm">Note à rembourser</div>
                  <input
                    className="input-field"
                    placeholder="Chercher par nom..."
                    value={line.search}
                    onChange={(e) => handleRembSearch(i, e.target.value)}
                    onFocus={() => handleRembFocus(i)}
                    onBlur={() => setTimeout(() => closeRembDropdown(i), 150)}
                    autoComplete="off"
                  />
                  {line.showDropdown && getActiveNotesSuggestions(line.search).length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                      {getActiveNotesSuggestions(line.search).slice(0, 8).map((note) => (
                        <div key={note.id} onMouseDown={() => handleRembSelect(i, note)}
                          style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            <strong>{note.personne}</strong>
                            <span style={{ color: '#6b7280', margin: '0 4px' }}>→</span>
                            {note.destinataire_nom}
                            <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>
                              {note.date ? note.date.substring(8, 10) + '/' + note.date.substring(5, 7) : ''}
                            </span>
                          </span>
                          <span style={{ fontWeight: 700, color: note.montant >= 0 ? '#16a34a' : '#dc2626', marginLeft: 8, whiteSpace: 'nowrap' }}>
                            {fmt(note.montant)} €
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="label-sm">Date</div>
                  <input className="input-field" type="date" value={line.date} onChange={(e) => updateRembLine(i, 'date', e.target.value)} />
                </div>
                <button className="btn btn-primary" style={{ padding: '8px 6px', background: line.selectedNote ? '#dc2626' : undefined, opacity: line.selectedNote ? 1 : 0.5 }}
                  onClick={() => handleSaveRemb(i)} title="Confirmer remboursement">💾</button>
              </div>
              {line.selectedNote && (
                <div style={{ marginTop: 5, fontSize: 11, padding: '4px 8px', background: '#fef2f2', borderRadius: 6, color: '#991b1b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{line.selectedNote.personne} → {line.selectedNote.destinataire_nom}</span>
                  <strong>{fmt(line.selectedNote.montant)} € → sera annulée</strong>
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-secondary" onClick={addRembLine} style={{ marginBottom: 14, fontSize: 12 }}>+ Remboursement</button>

          <div className="section-divider" />

          {/* Heures × 10 */}
          <div>
            <div className="card-title" style={{ marginBottom: 10 }}>Heures × 10 → Fiche Pierre</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px', gap: 8, alignItems: 'end' }}>
              <div>
                <div className="label-sm">Heures</div>
                <input className="input-field" type="number" placeholder="0" value={pierreHeures}
                  onChange={(e) => setPierreHeures(e.target.value)} />
              </div>
              <div>
                <div className="label-sm">Date</div>
                <input className="input-field" type="date" value={pierreDate}
                  onChange={(e) => setPierreDate(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ padding: '8px 6px' }} onClick={handleSavePierre} title="Sauvegarder">💾</button>
            </div>
            {pierreHeures && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                {pierreHeures}h × 10 = <strong>{fmt(parseFloat(pierreHeures) * 10)} €</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emprunt / Prêt */}
      <div className="card">
        <div className="card-title">Emprunt / Prêt</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['emprunt', 'pret'].map((t) => (
            <button
              key={t}
              className={pretForm.type === t ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontSize: 13, padding: '6px 16px' }}
              onClick={() => setPretForm({ ...pretForm, type: t })}
            >
              {t === 'emprunt' ? 'Emprunt' : 'Prêt'}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 130px 36px', gap: 8, alignItems: 'end' }}>
          <div>
            <div className="label-sm">Produit</div>
            <input className="input-field" placeholder="Nom de l'objet" value={pretForm.produit}
              onChange={(e) => setPretForm({ ...pretForm, produit: e.target.value })} />
          </div>
          <div>
            <div className="label-sm">Nombre</div>
            <input className="input-field" type="number" min="1" value={pretForm.nombre}
              onChange={(e) => setPretForm({ ...pretForm, nombre: e.target.value })} />
          </div>
          <div>
            <div className="label-sm">Lieu / Personne</div>
            <input className="input-field" placeholder="Où / Qui" value={pretForm.lieu}
              onChange={(e) => setPretForm({ ...pretForm, lieu: e.target.value })} />
          </div>
          <div>
            <div className="label-sm">Date</div>
            <input className="input-field" type="date" value={pretForm.date}
              onChange={(e) => setPretForm({ ...pretForm, date: e.target.value })} />
          </div>
          <button className="btn btn-primary" style={{ padding: '8px 6px' }} onClick={handleSavePret} title="Sauvegarder">💾</button>
        </div>

        {sessionPrets.length > 0 && (
          <div style={{ background: '#f0f9ff', padding: '10px', borderRadius: 8, marginTop: 14 }}>
            <div className="label-sm" style={{ marginBottom: 6 }}>ENREGISTRÉS (SESSION)</div>
            {sessionPrets.map((p) => (
              <div key={p.id} className="nota-row">
                <span style={{ fontSize: 12, color: p.type === 'emprunt' ? '#dc2626' : '#16a34a', fontWeight: 600, marginRight: 8 }}>
                  {p.type === 'emprunt' ? 'EMPRUNT' : 'PRÊT'}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{p.produit} {p.nombre > 1 ? `× ${p.nombre}` : ''} — {p.lieu}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
