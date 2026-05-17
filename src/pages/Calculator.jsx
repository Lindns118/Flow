import { useState, useEffect } from 'react';
import { addFiche, addPersonne, addNote, getPersonnes, addFichePierre, slugify } from '../db';

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MULTIPLIERS = [0.14, 0.16, 0.22];

export default function Calculator() {
  const [baseValues, setBaseValues] = useState(['', '', '']);
  const [diviseur, setDiviseur] = useState('');
  const [personRows, setPersonRows] = useState([
    { prenom: '', date: today(), valeur: '' },
    { prenom: '', date: today(), valeur: '' },
    { prenom: '', date: today(), valeur: '' },
  ]);
  const [noteLines, setNoteLines] = useState([
    { personne: '', montant: '', destinataire: '', date: today() },
  ]);
  const [lastNote, setLastNote] = useState(null);
  const [pierreHeures, setPierreHeures] = useState('');
  const [pierreDate, setPierreDate] = useState(today());
  const [personnesList, setPersonnesList] = useState([]);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    setPersonnesList(getPersonnes());
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

  const handleSaveFiche = (i) => {
    const p = personRows[i];
    if (!p.prenom || !p.date) return;
    addPersonne(p.prenom);
    addFiche(slugify(p.prenom), p.prenom, p.date, personneResults[i], 'salaire');
    setPersonnesList(getPersonnes());
    flashMsg(`✓ Sauvegardé: ${p.prenom}`);
  };

  const handleSaveNote = (i) => {
    const line = noteLines[i];
    if (!line.personne || !line.montant || !line.destinataire) return;
    const dest = line.destinataire === 'pierre'
      ? { key: 'pierre', nom: 'Pierre' }
      : personnesList.find((p) => p.key === line.destinataire) || { key: line.destinataire, nom: line.destinataire };
    const note = addNote({
      personne: line.personne,
      montant: parseFloat(line.montant),
      destinataire_key: dest.key,
      destinataire_nom: dest.nom,
      date: line.date || today(),
    });
    setLastNote(note);
    flashMsg('✓ Note enregistrée');
  };

  const addNoteLine = () => {
    setNoteLines([...noteLines, { personne: '', montant: '', destinataire: '', date: today() }]);
  };

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
    ...personnesList,
  ];

  return (
    <div className="page-container">
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
          <div className="label-sm" style={{ width: 120 }}>DIVISEUR (+)</div>
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
            <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px 36px', gap: 8, alignItems: 'end' }}>
                <div>
                  <div className="label-sm">Prénom</div>
                  <input className="input-field" placeholder="Prénom" value={p.prenom}
                    onChange={(e) => updatePersonRow(i, 'prenom', e.target.value)} />
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
                <div>
                  <button className="btn btn-primary" style={{ padding: '8px 6px', width: '100%' }} onClick={() => handleSaveFiche(i)} title="Sauvegarder">💾</button>
                </div>
              </div>
              <div style={{ marginTop: 6, textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
                {fmt(parseFloat(p.valeur) || 0)} × H({fmt(H)}) = <strong>{fmt(personneResults[i])}</strong>
              </div>
            </div>
          ))}
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
                  <input className="input-field" type="number" placeholder="±0" value={line.montant}
                    onChange={(e) => updateNote(i, 'montant', e.target.value)} />
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

          {lastNote && (
            <div style={{ background: '#f0f9ff', padding: '10px', borderRadius: 8, marginBottom: 14 }}>
              <div className="label-sm" style={{ marginBottom: 6 }}>NOTES ENREGISTRÉES (SESSION)</div>
              <div className="nota-row">
                <span style={{ flex: 1 }}>
                  {lastNote.personne} → {lastNote.destinataire_nom} ({lastNote.date ? lastNote.date.substring(5, 7) + '/' + lastNote.date.substring(2, 4) : ''})
                </span>
                <span style={{ color: lastNote.montant < 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                  {fmt(lastNote.montant)} €
                </span>
              </div>
            </div>
          )}

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
    </div>
  );
}
