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
    prets: getPrets(),
    dettes: getDettes(),
    bopGlobaux: getBopGlobaux(),
  };
}

export function setAllData(data) {
  if (data?.personnes !== undefined) localStorage.setItem('personnes', JSON.stringify(data.personnes));
  if (data?.fiches !== undefined) localStorage.setItem('fiches', JSON.stringify(data.fiches));
  if (data?.notes !== undefined) localStorage.setItem('notes', JSON.stringify(data.notes));
  if (data?.hiddenNotes !== undefined) localStorage.setItem('hiddenNotes', JSON.stringify(data.hiddenNotes));
  if (data?.fichesPierre !== undefined) localStorage.setItem('fichesPierre', JSON.stringify(data.fichesPierre));
  if (data?.prets !== undefined) localStorage.setItem('prets', JSON.stringify(data.prets));
  if (data?.dettes !== undefined) localStorage.setItem('dettes', JSON.stringify(data.dettes));
  if (data?.bopGlobaux !== undefined) localStorage.setItem('bopGlobaux', JSON.stringify(data.bopGlobaux));
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

// --- Dettes (carry-over balance between reset periods) ---
export function getDettes() {
  try {
    return JSON.parse(localStorage.getItem('dettes') || '{}');
  } catch {
    return {};
  }
}

export function saveDettes(dettes) {
  localStorage.setItem('dettes', JSON.stringify(dettes));
  scheduleDriveSync();
}

export function getDette(key) {
  return getDettes()[key] || 0;
}

// --- BOP total global (informational running total, manually entered, no effect on calculations) ---
export function getBopGlobaux() {
  try {
    return JSON.parse(localStorage.getItem('bopGlobaux') || '{}');
  } catch {
    return {};
  }
}

export function saveBopGlobaux(m) {
  localStorage.setItem('bopGlobaux', JSON.stringify(m));
  scheduleDriveSync();
}

export function getBopGlobal(key) {
  return getBopGlobaux()[key] || 0;
}

export function setBopGlobal(key, val) {
  const m = getBopGlobaux();
  const n = Number(val);
  if (n) m[key] = n; else delete m[key];
  saveBopGlobaux(m);
}

// Reset: delete fiches + hide notes from server's view (notes stay visible in NotesClients)
// Debt = salaires + notes only (BOP/BK tracked separately, not included in carry-over).
export function resetServeur(key) {
  const allFiches = getFiches().filter((f) => f.personne_key === key);
  const totalSalaires = allFiches.filter((f) => f.type === 'salaire').reduce((a, b) => a + b.montant, 0);
  const hidden = getHiddenNotes();
  const totalNotes = getNotes()
    .filter((n) => n.destinataire_key === key && !n.annulee && !hidden.includes(n.id))
    .reduce((a, b) => a + b.montant, 0);
  const effectiveTotal = totalSalaires + totalNotes + getDette(key);

  const dettes = getDettes();
  if (effectiveTotal < 0) {
    dettes[key] = effectiveTotal;
  } else {
    delete dettes[key];
  }
  saveDettes(dettes);

  // Delete all fiches (salaires, BK, BOP) — bopGlobal cumul persists separately
  deletePersonneData(key);
  const notes = getNotes();
  const hiddenSet = new Set(getHiddenNotes());
  notes.filter((n) => n.destinataire_key === key).forEach((n) => hiddenSet.add(n.id));
  localStorage.setItem('hiddenNotes', JSON.stringify([...hiddenSet]));
  scheduleDriveSync();
}

export function resetAllServeurs() {
  getPersonnes()
    .filter((p) => p.key !== 'pierre')
    .forEach((p) => resetServeur(p.key));
}

// Reset Pierre: delete all his fichesPierre + hide his received notes
// Debt = fiches (salaires/retraits) + notes only (BK tracked separately).
export function resetPierre() {
  const allFiches = getFichesPierre();
  const totalFiches = allFiches.filter((f) => f.type !== 'bk').reduce((a, b) => a + b.montant, 0);
  const hidden = getHiddenNotes();
  const totalNotes = getNotes()
    .filter((n) => n.destinataire_key === 'pierre' && !n.annulee && !hidden.includes(n.id))
    .reduce((a, b) => a + b.montant, 0);
  const effectiveTotal = totalFiches + totalNotes + getDette('pierre');

  const dettes = getDettes();
  if (effectiveTotal < 0) {
    dettes['pierre'] = effectiveTotal;
  } else {
    delete dettes['pierre'];
  }
  saveDettes(dettes);

  localStorage.setItem('fichesPierre', JSON.stringify([]));
  const notes = getNotes();
  const hiddenSet = new Set(getHiddenNotes());
  notes.filter((n) => n.destinataire_key === 'pierre').forEach((n) => hiddenSet.add(n.id));
  localStorage.setItem('hiddenNotes', JSON.stringify([...hiddenSet]));
  scheduleDriveSync();
}

export function resetTous() {
  resetAllServeurs();
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

// type: 'salaire' (heures × 10) | 'retrait' (montant direct, négatif) | 'bk' (montant direct, positif, déduit du total)
export function addFichePierre({ date, heures, montantDirect, notes, type = 'salaire' }) {
  const fiches = getFichesPierre();
  const mois = date.substring(0, 7);
  const montant = type === 'retrait' ? -Math.abs(Number(montantDirect))
    : type === 'bk' ? Math.abs(Number(montantDirect))
    : Number(heures) * 10;
  const id = String(Date.now() + Math.random());
  fiches.push({
    id, date, mois, type,
    heures: type === 'salaire' ? Number(heures) : 0,
    montant,
    notes: notes || '',
  });
  saveFichesPierre(fiches);
  return id;
}

export function deleteFichePierre(id) {
  const fiches = getFichesPierre().filter((f) => f.id !== id);
  saveFichesPierre(fiches);
}

export function deleteFichesPierreMois(mois) {
  const fiches = getFichesPierre().filter((f) => f.mois !== mois);
  saveFichesPierre(fiches);
}

export function updateFichePierre(id, { date, heures, montantDirect, notes, type }) {
  const fiches = getFichesPierre();
  const fiche = fiches.find((f) => f.id === id);
  if (!fiche) return;
  fiche.date = date;
  fiche.mois = date.substring(0, 7);
  fiche.type = type || fiche.type || 'salaire';
  fiche.notes = notes || '';
  if (fiche.type === 'retrait') {
    fiche.montant = -Math.abs(Number(montantDirect));
    fiche.heures = 0;
  } else if (fiche.type === 'bk') {
    fiche.montant = Math.abs(Number(montantDirect));
    fiche.heures = 0;
  } else {
    fiche.heures = Number(heures);
    fiche.montant = Number(heures) * 10;
  }
  saveFichesPierre(fiches);
}

// --- Prêts / Emprunts ---
export function getPrets() {
  try {
    return JSON.parse(localStorage.getItem('prets') || '[]');
  } catch {
    return [];
  }
}

export function savePrets(prets) {
  localStorage.setItem('prets', JSON.stringify(prets));
  scheduleDriveSync();
}

export function addPret({ type, produit, nombre, lieu, date }) {
  const prets = getPrets();
  const id = String(Date.now() + Math.random());
  prets.push({ id, type, produit, nombre: Number(nombre) || 1, lieu, date, clos: false });
  savePrets(prets);
  return id;
}

export function togglePretClos(id) {
  const prets = getPrets();
  const pret = prets.find((p) => p.id === id);
  if (!pret) return;
  pret.clos = !pret.clos;
  savePrets(prets);
}

export function deletePret(id) {
  savePrets(getPrets().filter((p) => p.id !== id));
}
