import { expect } from "vitest";

type ErreurPostgrest = { code?: string; message?: string } | null | undefined;

/**
 * Codes que PostgREST rend quand il **refuse** — par opposition à ceux qu'il rend quand il ne
 * comprend pas la demande.
 *
 * 42501 = `permission denied` (privilège Postgres retiré), PGRST202/PGRST203 = fonction absente ou
 * non exposée, PGRST301 = jeton refusé. Une table inconnue (PGRST205) et une colonne inconnue
 * (42703) n'en font **pas** partie : elles signalent une faute de frappe dans le test, pas un
 * verrou en base.
 */
const CODES_DE_REFUS = ["42501", "PGRST202", "PGRST203", "PGRST301"];
const MESSAGES_DE_REFUS = /permission denied|not authoriz|could not find the function|jwt|row-level security/i;

/** Vrai si l'erreur est bien un refus de droits, et non une erreur de rédaction du test. */
export function estRefus(error: ErreurPostgrest): boolean {
  if (!error) return false;
  return CODES_DE_REFUS.includes(error.code ?? "") || MESSAGES_DE_REFUS.test(error.message ?? "");
}

/**
 * Vrai si l'erreur trahit une faute du test lui-même : table ou colonne qui n'existe pas, relation
 * mal orthographiée. C'est le piège de la forme `if (!error) expect(data).toHaveLength(0)` — une
 * table mal écrite produit une erreur, l'assertion est sautée, et le test passe au vert sans avoir
 * rien vérifié du tout.
 */
export function estFauteDeTest(error: ErreurPostgrest): boolean {
  if (!error) return false;
  return (
    ["PGRST204", "PGRST205", "42703", "42P01"].includes(error.code ?? "") ||
    /does not exist|could not find the table|could not find the '\w+' column/i.test(error.message ?? "")
  );
}

/**
 * Épreuve type d'une lecture qui doit rester fermée.
 *
 * Deux réponses sont acceptables et une seule ne l'est pas :
 *   — PostgREST **refuse** (privilège retiré) : très bien ;
 *   — PostgREST **répond zéro ligne** (la RLS filtre) : très bien aussi ;
 *   — PostgREST rend des lignes : la table fuit.
 *
 * Toute autre erreur — table inconnue, colonne inconnue — fait échouer l'épreuve au lieu de la
 * rendre muette : c'est la différence entre « le verrou tient » et « le test s'est trompé de nom ».
 */
export function attendreLectureFermee(
  reponse: { data: unknown; error: ErreurPostgrest },
  quoi: string,
) {
  const { data, error } = reponse;
  if (error) {
    expect(
      estRefus(error),
      `${quoi} : erreur inattendue « ${error.message} » (code ${error.code}) — ce n'est pas un refus de droits, ` +
        "le nom de la table ou de la colonne est-il juste ?",
    ).toBe(true);
    return;
  }
  expect(data as unknown[], `${quoi} : des lignes sont sorties`).toHaveLength(0);
}
