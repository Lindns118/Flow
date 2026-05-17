// --- Drive sync ---
let driveSyncCallback = null;
let syncTimer = null;

export function setDriveSyncCallback(fn) {
  driveSyncCallback = fn;
}

function scheduleDriveSync() {
  if (!driveSyncCallback) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(driveSyncCallback, 2000);
}

export function getAllData() {
  return {
    personnes: getPersonnes(),
    fiches: getFiches(),
    notes: getNotes(),
    hiddenNotes: getHiddenNotes(),
    fichesPierre: getFichesPierre(),
  };
}

export function setAllData(data) {
  if (data?.personnes !== undefined) localStorage.setItem('personnes', JSON.stringify(data.personnes));
  if (data?.fiches !== undefined) localStorage.setItem('fiches', JSON.stringify(data.fiches));
  if (data?.notes !== undefined) localStorage.setItem('notes', JSON.stringify(data.notes));
  if (data?.hiddenNotes !== undefined) localStorage.setItem('hiddenNotes', JSON.stringify(data.hiddenNotes));
  if (data?.fichesPierre !== undefined) localStorage.setItem('fichesPierre', JSON.stringify(data.fichesPierre));
}

// slugify: normalize name to slug
export function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// --- Personnes ---
export function getPersonnes() {
  try {
    return JSON.parse(localStorage.getItem('personnes') || '[]');
  } catch {
    return [];
  }
}

export function savePersonnes(personnes) {
  localStorage.setItem('personnes', JSON.stringify(personnes));
  scheduleDriveSync();
}

export function addPersonne(nom) {
  const key = slugify(nom);
  const personnes = getPersonnes();
  const existing = personnes.find((p) => p.key === key);
  if (existing) return existing;
  const newP = { nom, key };
  personnes.push(newP);
  savePersonnes(personnes);
  return newP;
}

// --- FicheSalaire ---
export function getFiches() {
  try {
    return JSON.parse(localStorage.getItem('fiches') || '[]');
  } catch {
    return [];
  }
}

export function saveFiches(fiches) {
  localStorage.setItem('fiches', JSON.stringify(fiches));
  scheduleDriveSync();
}

export function addFiche(personne_key, personne_nom, date, montant, type) {
  const fiches = getFiches();
  const id = String(Date.now() + Math.random());
  fiches.push({ id, personne_key, personne_nom, date, montant: Number(montant), type });
  saveFiches(fiches);
  return id;
}

export function deleteFiche(id) {
  const fiches = getFiches().filter((f) => f.id !== id);
  saveFiches(fiches);
}

export function deletePersonneData(key) {
  const fiches = getFiches().filter((f) => f.personne_key !== key);
  saveFiches(fiches);
}

export function deletePersonne(key) {
  deletePersonneData(key);
  const personnes = getPersonnes().filter((p) => p.key !== key);
  savePersonnes(personnes);
}

// --- NoteClient ---
export function getNotes() {
  try {
    return JSON.parse(localStorage.getItem('notes') || '[]');
  } catch {
    return [];
  }
}

export function saveNotes(notes) {
  localStorage.setItem('notes', JSON.stringify(notes));
  scheduleDriveSync();
}

export function addNote({ personne, montant, destinataire_key, destinataire_nom, date }) {
  const notes = getNotes();
  const newNote = {
    id: String(Date.now() + Math.random()),
    personne,
    montant: Number(montant),
    destinataire_key,
    destinataire_nom,
    date,
    annulee: false,
  };

  // Auto-cancellation: same destinataire_key, same personne, same date, opposite montant
  const opposite = notes.find(
    (n) =>
      !n.annulee &&
      n.destinataire_key === destinataire_key &&
      n.personne === personne &&
      n.date === date &&
      Number(n.montant) === -Number(montant)
  );

  if (opposite) {
    opposite.annulee = true;
    newNote.annulee = true;
  }

  notes.push(newNote);
  saveNotes(notes);
  return newNote;
}

export function deleteNote(id) {
  const notes = getNotes().filter((n) => n.id !== id);
  saveNotes(notes);
}

export function toggleNoteHidden(id) {
  const hidden = getHiddenNotes();
  if (hidden.includes(id)) {
    const updated = hidden.filter((h) => h !== id);
    localStorage.setItem('hiddenNotes', JSON.stringify(updated));
  } else {
    hidden.push(id);
    localStorage.setItem('hiddenNotes', JSON.stringify(hidden));
  }
  scheduleDriveSync();
}

export function getHiddenNotes() {
  try {
    return JSON.parse(localStorage.getItem('hiddenNotes') || '[]');
  } catch {
    return [];
  }
}

// --- FichePierre ---
export function getFichesPierre() {
  try {
    return JSON.parse(localStorage.getItem('fichesPierre') || '[]');
  } catch {
    return [];
  }
}

export function saveFichesPierre(fiches) {
  localStorage.setItem('fichesPierre', JSON.stringify(fiches));
  scheduleDriveSync();
}

export function addFichePierre({ date, heures, notes }) {
  const fiches = getFichesPierre();
  const montant = Number(heures) * 10;
  const mois = date.substring(0, 7);
  const existing = fiches.find((f) => f.date === date);
  if (existing) {
    existing.heures = Number(heures);
    existing.montant = montant;
    existing.notes = notes || '';
    existing.mois = mois;
    saveFichesPierre(fiches);
    return existing.id;
  }
  const id = String(Date.now() + Math.random());
  fiches.push({ id, date, mois, heures: Number(heures), montant, notes: notes || '' });
  saveFichesPierre(fiches);
  return id;
}

export function deleteFichePierre(id) {
  const fiches = getFichesPierre().filter((f) => f.id !== id);
  saveFichesPierre(fiches);
}

export function updateFichePierre(id, { date, heures, notes }) {
  const fiches = getFichesPierre();
  const fiche = fiches.find((f) => f.id === id);
  if (!fiche) return;
  fiche.date = date;
  fiche.heures = Number(heures);
  fiche.montant = Number(heures) * 10;
  fiche.mois = date.substring(0, 7);
  fiche.notes = notes || '';
  saveFichesPierre(fiches);
}
