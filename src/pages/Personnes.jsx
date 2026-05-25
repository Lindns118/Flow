import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPersonnes, deletePersonne, resetServeur, resetTous, renamePersonne, archiveToAncienServeur } from '../db';

function Modal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
          <button className="btn btn-danger" onClick={onConfirm}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}

export default function Personnes() {
  const [personnes, setPersonnes] = useState([]);
  const [modal, setModal] = useState(null);
  const [editKey, setEditKey] = useState(null);
  const [editNom, setEditNom] = useState('');

  const load = () => setPersonnes(getPersonnes());
  useEffect(() => { load(); }, []);

  const confirmReinitialiser = (p) => {
    setModal({
      title: 'Réinitialiser',
      message: `Supprimer toutes les fiches de ${p.nom} et masquer ses notes de sa fiche ? (les notes restent visibles dans Notes Clients)`,
      onConfirm: () => {
        resetServeur(p.key);
        setModal(null);
        load();
      },
    });
  };

  const confirmReinitialiserTous = () => {
    setModal({
      title: 'Réinitialiser tous',
      message: 'Supprimer toutes les fiches et masquer les notes de tous les serveurs (sauf Pierre) ?',
      onConfirm: () => {
        resetTous();
        setModal(null);
        load();
      },
    });
  };

  const confirmSupprimer = (p) => {
    setModal({
      title: 'Supprimer la personne',
      message: `Supprimer ${p.nom} et toutes ses fiches salaire ? (les notes clients ne seront pas supprimées)`,
      onConfirm: () => {
        deletePersonne(p.key);
        setModal(null);
        load();
      },
    });
  };

  const confirmArchiver = (p) => {
    setModal({
      title: 'Archiver en ancien serveur',
      message: `Déplacer ${p.nom} vers Anciens Serveurs ? Sa dette actuelle sera copiée comme dette de départ. Ses fiches salaire seront supprimées.`,
      onConfirm: () => {
        archiveToAncienServeur(p.key);
        setModal(null);
        load();
      },
    });
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Personnes</h1>
        {personnes.length > 0 && (
          <button className="btn btn-danger" style={{ fontSize: 13 }} onClick={confirmReinitialiserTous}>
            Réinitialiser tous
          </button>
        )}
      </div>

      {modal && (
        <Modal
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {personnes.length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>Aucune personne enregistrée</div>
      )}

      {personnes.map((p) => (
        <div key={p.key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {p.key !== 'pierre' && (
            <button
              className="btn btn-danger"
              style={{ padding: '6px 10px', fontSize: 13 }}
              onClick={() => confirmReinitialiser(p)}
              title="Réinitialiser (fiches + notes masquées)"
            >↺</button>
          )}

          {editKey === p.key ? (
            <>
              <input
                className="input-field"
                value={editNom}
                onChange={(e) => setEditNom(e.target.value)}
                style={{ flex: 1, fontSize: 15 }}
                autoFocus
              />
              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 13 }}
                onClick={() => {
                  if (editNom.trim()) { renamePersonne(p.key, editNom.trim()); load(); }
                  setEditKey(null);
                }}
              >✓</button>
              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 13 }}
                onClick={() => setEditKey(null)}
              >✕</button>
            </>
          ) : (
            <>
              <Link to={p.key === 'pierre' ? '/pierre' : `/personne/${p.key}`} style={{ flex: 1, fontWeight: 600, fontSize: 16, color: '#1f2937' }}>
                {p.nom}
              </Link>
              {p.key !== 'pierre' && (
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 13 }}
                  onClick={() => { setEditKey(p.key); setEditNom(p.nom); }}
                  title="Renommer"
                >✏️</button>
              )}
            </>
          )}

          {editKey !== p.key && p.key !== 'pierre' && (
            <>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: 13 }}
                onClick={() => confirmArchiver(p)}
                title="Archiver en ancien serveur"
              >👴</button>
              <button
                className="btn btn-danger"
                style={{ padding: '6px 10px', fontSize: 13 }}
                onClick={() => confirmSupprimer(p)}
                title="Supprimer la personne"
              >✕</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
