import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAncienServeurs, getAncienServeurEntries,
  addAncienServeurEntry, deleteAncienServeurEntry,
} from '../db';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : '';

export default function AncienServeur() {
  const { key } = useParams();
  const [serveur, setServeur] = useState(null);
  const [entries, setEntries] = useState([]);
  const [negInput, setNegInput] = useState('');
  const [negDate, setNegDate] = useState(today());
  const [posInput, setPosInput] = useState('');
  const [posDate, setPosDate] = useState(today());

  const load = () => {
    const s = getAncienServeurs().find((s) => s.key === key);
    setServeur(s || { key, nom: key });
    setEntries(getAncienServeurEntries().filter((e) => e.serveur_key === key));
  };

  useEffect(() => { load(); }, [key]);

  const negEntries = entries.filter((e) => e.montant < 0);
  const posEntries = entries.filter((e) => e.montant > 0);
  const negTotal = negEntries.reduce((a, b) => a + b.montant, 0);
  const posTotal = posEntries.reduce((a, b) => a + b.montant, 0);
  const negApplied = negTotal * 0.6;
  const totalGeneral = negApplied + posTotal;

  const handleAddNeg = () => {
    if (!negInput) return;
    addAncienServeurEntry(key, -Math.abs(parseFloat(negInput)), negDate);
    setNegInput('');
    load();
  };

  const handleAddPos = () => {
    if (!posInput) return;
    addAncienServeurEntry(key, Math.abs(parseFloat(posInput)), posDate);
    setPosInput('');
    load();
  };

  return (
    <div className="page-container">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        {serveur?.nom || key}
      </h1>

      {/* Dettes — comptées à 60% */}
      <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
        <div className="card-title" style={{ color: '#dc2626' }}>Dettes</div>
        {negEntries.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune entrée</div>
        )}
        {negEntries.map((e) => (
          <div key={e.id} className="row-hover nota-row">
            <span style={{ flex: 1, color: '#6b7280', fontSize: 13 }}>{fmtDate(e.date)}</span>
            <span style={{ fontWeight: 600, color: '#dc2626' }}>{fmt(e.montant)} €</span>
            <button
              className="delete-btn"
              onClick={() => { deleteAncienServeurEntry(e.id); load(); }}
            >✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="input-field"
            type="date"
            value={negDate}
            onChange={(e) => setNegDate(e.target.value)}
            style={{ width: 140 }}
          />
          <input
            className="input-field"
            type="number"
            placeholder="Montant..."
            value={negInput}
            onChange={(e) => setNegInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNeg()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-danger" onClick={handleAddNeg}>+</button>
        </div>
        <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>
          Sous-total : {fmt(negTotal)} €
        </div>
        <div style={{ marginTop: 4, fontWeight: 700, color: '#dc2626' }}>
          Total dettes (60%) : {fmt(negApplied)} €
        </div>
      </div>

      {/* Paiements — comptés à 100% */}
      <div className="card" style={{ borderLeft: '4px solid #16a34a' }}>
        <div className="card-title" style={{ color: '#16a34a' }}>Paiements</div>
        {posEntries.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune entrée</div>
        )}
        {posEntries.map((e) => (
          <div key={e.id} className="row-hover nota-row">
            <span style={{ flex: 1, color: '#6b7280', fontSize: 13 }}>{fmtDate(e.date)}</span>
            <span style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(e.montant)} €</span>
            <button
              className="delete-btn"
              onClick={() => { deleteAncienServeurEntry(e.id); load(); }}
            >✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="input-field"
            type="date"
            value={posDate}
            onChange={(e) => setPosDate(e.target.value)}
            style={{ width: 140 }}
          />
          <input
            className="input-field"
            type="number"
            placeholder="Montant..."
            value={posInput}
            onChange={(e) => setPosInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPos()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleAddPos}>+</button>
        </div>
        <div style={{ marginTop: 10, fontWeight: 700, color: '#16a34a' }}>
          Total paiements (100%) : {fmt(posTotal)} €
        </div>
      </div>

      {/* Total général */}
      <div
        className="blue-total"
        style={{
          fontSize: 18, padding: '16px 20px',
          background: totalGeneral < 0 ? '#fef2f2' : undefined,
          color: totalGeneral < 0 ? '#dc2626' : undefined,
        }}
      >
        Total : {fmt(totalGeneral)} €
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          {fmt(negApplied)} (dettes 60%) + {fmt(posTotal)} (paiements 100%) = {fmt(totalGeneral)} €
        </div>
      </div>
    </div>
  );
}
