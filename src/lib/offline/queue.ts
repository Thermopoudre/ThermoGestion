/**
 * File d'attente hors ligne pour le pointage (lot C, C4).
 *
 * Portée volontairement réduite au pointage mono-projet (`demarrer_etape` / `avancer_etape`,
 * utilisés par /scan) : le poste partagé (/pointage, `demarrer_pointage_lot` /
 * `arreter_pointage_lot`) répond de façon synchrone avec la répartition de temps calculée par le
 * serveur — une réponse qu'on ne peut pas deviner hors ligne, donc pas de mise en file à l'aveugle
 * pour ce flux-là.
 *
 * Stockage : IndexedDB en conditions réelles (persiste à travers un rechargement de page ou la
 * fermeture de l'onglet, ce qu'un simple tableau en mémoire ne fait pas — et un atelier hors
 * réseau ferme l'onglet par réflexe). Bascule automatique sur un tableau en mémoire quand
 * `indexedDB` n'existe pas (rendu serveur, ou environnement de test Node sans jsdom) : mêmes
 * fonctions exportées, même comportement observable, ce qui permet de tester toute la logique de
 * file (ordre, rejeu, arrêt au premier échec réseau) sans navigateur.
 */

export type TypeActionPointage = "demarrer_etape" | "avancer_etape";

export type PointageAction = {
  type: TypeActionPointage;
  projet_id: string;
  /** Horodatage réel du geste (capturé au clic), jamais celui du rejeu à la reconnexion. */
  survenu_a: string;
};

export type ActionEnFile = PointageAction & {
  id: string;
  cree_a: string;
};

const DB_NOM = "tg-offline";
const DB_VERSION = 1;
const MAGASIN = "pointages";

function idbDisponible(): boolean {
  return typeof indexedDB !== "undefined";
}

// ── Repli mémoire (SSR, tests) ──────────────────────────────────────────────
let memoire: ActionEnFile[] = [];

function idGenere(): string {
  // `crypto.randomUUID` est disponible dans tous les navigateurs modernes et dans Node ≥ 19 (donc
  // sous Vitest) ; le repli couvre le seul cas contraire sans ajouter de dépendance.
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ouvrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOM, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MAGASIN)) db.createObjectStore(MAGASIN, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function avecMagasin<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ouvrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, mode);
    const store = tx.objectStore(MAGASIN);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Ajoute une action à la file. Renvoie l'entrée créée (utile pour un affichage optimiste). */
export async function enfiler(action: PointageAction): Promise<ActionEnFile> {
  const entree: ActionEnFile = { ...action, id: idGenere(), cree_a: new Date().toISOString() };
  if (!idbDisponible()) {
    memoire.push(entree);
    return entree;
  }
  await avecMagasin<IDBValidKey>("readwrite", (s) => s.add(entree));
  return entree;
}

/**
 * Liste les actions en attente, dans l'ordre où elles ont été posées (FIFO — l'ordre compte : un
 * « avancer_etape » doit rejouer après le « demarrer_etape » du même projet, sinon le
 * chronométrage serveur n'a pas de début à clôturer).
 */
export async function listerEnAttente(): Promise<ActionEnFile[]> {
  if (!idbDisponible()) return [...memoire].sort((a, b) => a.cree_a.localeCompare(b.cree_a));
  const tout = await avecMagasin<ActionEnFile[]>("readonly", (s) => s.getAll() as unknown as IDBRequest<ActionEnFile[]>);
  return [...tout].sort((a, b) => a.cree_a.localeCompare(b.cree_a));
}

export async function compterEnAttente(): Promise<number> {
  return (await listerEnAttente()).length;
}

export async function retirer(id: string): Promise<void> {
  if (!idbDisponible()) {
    memoire = memoire.filter((a) => a.id !== id);
    return;
  }
  await avecMagasin<undefined>("readwrite", (s) => s.delete(id));
}

/** Vide entièrement la file — réservé aux tests et au diagnostic. */
export async function vider(): Promise<void> {
  if (!idbDisponible()) {
    memoire = [];
    return;
  }
  await avecMagasin<undefined>("readwrite", (s) => s.clear());
}

/**
 * Une erreur réseau (fetch qui n'a pas pu joindre le serveur) se distingue d'une erreur métier
 * (RLS, contrainte, projet supprimé) par son message générique — Postgrest-js ne fait pas
 * remonter de code dédié dans ce cas, seulement le message brut du `fetch` échoué.
 */
export function estErreurReseau(error: { message?: string } | null | undefined): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("fetch") || m.includes("network") || m.includes("réseau");
}

/**
 * Rejoue la file dans l'ordre. `rejoueur` doit renvoyer `true` si l'action a été acceptée par le
 * serveur (elle est alors retirée de la file), `false` sinon. On s'arrête à la première action qui
 * échoue plutôt que de continuer dans le désordre : rejouer une « avancer_etape » avant son
 * « demarrer_etape » ferait échouer le chronométrage silencieusement côté serveur.
 */
export async function rejouer(
  rejoueur: (action: ActionEnFile) => Promise<boolean>,
): Promise<{ ok: number; restantes: number }> {
  const file = await listerEnAttente();
  let ok = 0;
  for (const action of file) {
    const reussi = await rejoueur(action);
    if (!reussi) break;
    await retirer(action.id);
    ok += 1;
  }
  return { ok, restantes: (await listerEnAttente()).length };
}
