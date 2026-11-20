import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Le journal des questions, et le compteur qui en découle.
 *
 * ─── LA TABLE ────────────────────────────────────────────────────────────────────────────────
 *
 * Créée par la migration `60_assistant_journal.sql` (F2), qui applique très exactement la DDL
 * ci-dessous plus une fonction `assistant_questions_du_jour()`.
 *
 *   create table public.assistant_journal (
 *     id           uuid primary key default gen_random_uuid(),
 *     atelier_id   uuid not null default public.current_atelier_id() references public.ateliers(id) on delete cascade,
 *     user_id      uuid not null default auth.uid() references public.users(id),
 *     pose_at      timestamptz not null default now(),
 *     question     text not null,
 *     -- Les outils appelés et leurs paramètres : c'est CE QUI EST SORTI DE LA BASE, et donc ce
 *     -- que l'atelier doit pouvoir relire. La réponse du modèle n'est pas conservée : elle se
 *     -- redéduit des mêmes outils, et la garder ferait du journal un second entrepôt de données
 *     -- commerciales à protéger pour rien.
 *     outils       jsonb not null default '[]'::jsonb,
 *     modele       text,
 *     cout_eur     numeric(10,5) not null default 0,
 *     jetons_in    int not null default 0,
 *     jetons_out   int not null default 0,
 *     erreur       text
 *   );
 *   create index on public.assistant_journal (atelier_id, pose_at desc);
 *   alter table public.assistant_journal enable row level security;
 *   -- Lecture : le bureau et le responsable, comme pour /relances. L'opérateur n'a rien à y voir.
 *   create policy lecture on public.assistant_journal for select
 *     using (atelier_id = public.current_atelier_id() and public.acces_commercial());
 *   -- Écriture : n'importe quel membre de l'atelier, pour lui-même. Aucune mise à jour, aucune
 *   -- suppression : un journal qu'on peut réécrire ne prouve rien (même principe que
 *   -- `trg_journal_inalterable`) — imposé ici par un trigger dédié, révoqué de PostgREST.
 *   create policy ecriture on public.assistant_journal for insert
 *     with check (atelier_id = public.current_atelier_id() and user_id = auth.uid());
 *
 * `atelier_id` a un DEFAULT plutôt qu'un paramètre : c'est la base qui décide de quel atelier
 * relève la ligne. Le serveur ne le fournit pas, donc il ne peut pas se tromper, et un appel
 * forgé ne peut pas écrire dans le journal d'un autre.
 *
 * ─── LE COMPTAGE PASSE PAR UNE FONCTION, PAS PAR UN SELECT DIRECT ────────────────────────────
 *
 * La policy de lecture est réservée au bureau : un `select … count` posé par un opérateur rendrait
 * `null`, donc AUCUN plafond, alors que F1 ouvre justement des outils de production
 * (`journee_du_matin`, `pieces_pretes_non_livrees`…) au rôle atelier. Le compteur passe donc par
 * `assistant_questions_du_jour()`, une fonction `security definer` qui rend le seul nombre — jamais
 * le texte des questions — quel que soit le rôle de l'appelant.
 */

export type EntreeJournal = {
  question: string;
  outils: { outil: string; parametres: Record<string, unknown>; lignes: number }[];
  modele: string | null;
  cout_eur: number;
  /** Jetons d'entrée et de sortie cumulés sur la question, pour reconstituer un coût a posteriori. */
  jetons_entree?: number;
  jetons_sortie?: number;
  erreur?: string | null;
};

/**
 * Range la question. N'échoue JAMAIS bruyamment : une réponse correcte ne doit pas être perdue
 * parce que sa trace n'a pas pu s'écrire. L'échec part dans les logs du serveur.
 *
 * Volontairement absent de l'objet inséré : tout ce qui ressemblerait à la RÉPONSE du modèle. Le
 * journal constate une question posée et ce qui a été lu pour y répondre — jamais le texte rédigé,
 * qui n'a aucune valeur de preuve et ferait du journal un second endroit à sécuriser pour rien.
 */
export async function journaliser(sb: SupabaseClient, e: EntreeJournal): Promise<void> {
  const { error } = await sb.from("assistant_journal").insert({
    question: e.question,
    outils: e.outils,
    modele: e.modele,
    cout_eur: e.cout_eur,
    jetons_in: e.jetons_entree ?? 0,
    jetons_out: e.jetons_sortie ?? 0,
    erreur: e.erreur ?? null,
  });
  if (error) console.error("[assistant] journal indisponible", error.message);
}

/**
 * Nombre de questions déjà posées aujourd'hui par l'atelier — `null` si le compteur est
 * indisponible (table absente, panne de la fonction).
 *
 * Appelle `assistant_questions_du_jour()` plutôt qu'un `select … count` : c'est ce qui rend le
 * plafond applicable à TOUS les rôles, pas seulement à ceux qui ont le droit de lire le journal.
 * La journée comptée est celle de Paris — c'est la fonction, en base, qui porte cette règle
 * (même bascule que {@link import("@/lib/assistant/dates").jourParis}) : le plafond doit se
 * comprendre (« trente par jour »), et un plafond glissant se vit comme une panne aléatoire.
 */
export async function questionsDuJour(sb: SupabaseClient): Promise<number | null> {
  const { data, error } = await sb.rpc("assistant_questions_du_jour");
  if (error) return null;
  return typeof data === "number" ? data : null;
}

export function quotaDepasse(dejaPosees: number | null, plafond: number): boolean {
  return dejaPosees !== null && dejaPosees >= plafond;
}
