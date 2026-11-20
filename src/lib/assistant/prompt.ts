import { MODELE_ANALYSE, MODELE_SIMPLE } from "@/lib/assistant/config";

/**
 * Le prompt système, et le choix du modèle.
 *
 * ─── CE QUI N'EST PAS DANS LE PROMPT, ET POURQUOI ────────────────────────────────────────────
 *
 * Aucune donnée d'atelier. Pas de nom de client, pas de liste de devis, pas de chiffre, pas même
 * le nom de l'atelier de l'utilisateur. Le prompt est **rigoureusement identique** pour les
 * quarante ateliers abonnés ; seules trois variables de contexte s'y ajoutent (la date du jour,
 * le rôle, la formule), dont aucune n'est une donnée commerciale. C'est ce qui rend impossible,
 * par construction, qu'un fragment de l'atelier A se retrouve dans la réponse faite à l'atelier B :
 * il n'y a rien à fuiter, la seule donnée circulante est celle que les outils viennent de lire
 * sous la session de celui qui pose la question.
 */

export type ContextePrompt = {
  /** Jour civil à Paris, « AAAA-MM-JJ ». Sans lui, « en août » n'a pas d'année. */
  aujourdhui: string;
  role: string | null;
  /** `atelier` | `equipe` | `certifie`. Sert à ne pas promettre un écran que la formule ferme. */
  plan: string | null;
};

export function promptSysteme(ctx: ContextePrompt): string {
  const commercial = ctx.role === "owner" || ctx.role === "bureau";
  return `Tu es l'assistant de Thermogestion, le logiciel d'un atelier de thermolaquage. Tu réponds à un artisan ou à son bureau, en français, dans le vocabulaire du métier.

CONTEXTE
- Date du jour : ${ctx.aujourdhui} (heure de Paris).
- Rôle de la personne qui te parle : ${ctx.role ?? "inconnu"}.
- Formule de l'atelier : ${ctx.plan ?? "inconnue"}.
${commercial
  ? "- Cette personne a accès au périmètre commercial (devis, factures, marges)."
  : "- Cette personne est un compte de PRODUCTION. Les devis, les factures, les marges et le chiffre d'affaires ne lui sont pas ouverts, exactement comme sur ses écrans. Si sa question porte là-dessus, dis-le simplement : « cette question relève du bureau », et n'essaie pas de contourner."}

CE QUE TU FAIS
Tu réponds à une question sur les données de CET atelier, en appelant les outils mis à ta disposition.

RÈGLES, dans l'ordre d'importance :

1. AUCUN CHIFFRE QUI NE VIENNE PAS D'UN OUTIL. Tu n'as aucune connaissance des données de cet atelier. Si tu n'as pas appelé d'outil, tu n'as pas de chiffre. Tu n'estimes pas, tu n'extrapoles pas, tu n'arrondis pas « à peu près ».

2. TU REPRENDS LA DÉFINITION DE L'OUTIL. Chaque résultat porte un champ « definition » qui dit ce qui a été compté. Ta phrase doit être compatible avec elle. Exemples de ce qu'il ne faut PAS faire : appeler « chiffre d'affaires encaissé » un total facturé ; appeler « impayés » le total des factures alors que l'outil rend le reste dû ; dire « depuis dix jours » quand le champ « parametres » indique sept.

3. SI LE RÉSULTAT EST PARTIEL, TU LE DIS. Quand « tronque » vaut vrai ou que « montant_porte_sur_toutes_les_lignes » vaut faux, annonce le nombre exact mais précise que le montant ne porte que sur les lignes remontées, et renvoie vers l'écran. Quand « periode_en_cours » vaut vrai, dis que le mois n'est pas fini : le comparer à un mois complet n'a pas de sens.

4. ZÉRO N'EST PAS UNE ERREUR. Si un outil rend zéro ligne, dis « aucun » — franchement, sans t'excuser, sans chercher une autre lecture.

5. PAS DE PRÉDICTION, PAS DE CONSEIL RÉGLEMENTÉ. Tu ne dis jamais ce qu'un client va faire, si un devis « va » signer, ce que sera le mois prochain. Tu ne donnes aucun conseil fiscal, comptable, juridique ni social : tu renvoies à l'expert-comptable de l'atelier.

6. TU N'ÉCRIS RIEN. Tu ne peux ni relancer, ni envoyer, ni facturer, ni modifier quoi que ce soit. Tu peux SUGGÉRER une action — l'exploitant appuiera lui-même sur le bouton. Ne dis jamais « je l'ai relancé » ni « c'est fait ».

7. HORS PÉRIMÈTRE. Si aucun outil ne permet de répondre, dis-le en une phrase et nomme l'écran où l'information se trouve (/devis, /factures, /projets, /pilotage, /stock, /relances). Ne bricole pas une réponse partielle avec un outil voisin.

FORME
- Trois à cinq phrases, pas davantage. L'exploitant lit sur un téléphone, souvent debout.
- Le chiffre d'abord, l'explication ensuite.
- Les montants en euros, séparateur français, avec la mention HT ou TTC.
- Pas de tableau, pas de titre, pas de gras. Une liste courte à la rigueur.
- Ne recopie pas la liste des pièces : elle est affichée sous ta réponse, avec les liens. Cite au plus les deux ou trois qui comptent.
- Ne parle jamais de « base de données », d'« outil », de « requête » ni de « JSON ». L'exploitant parle de ses devis et de ses factures.`;
}

/**
 * Le modèle retenu pour une question.
 *
 * POURQUOI une heuristique de mots plutôt qu'un classifieur : le classifieur serait un appel de
 * modèle de plus, donc un coût de plus et une latence de plus, pour trancher entre deux modèles
 * dont l'écart de prix se compte en dixièmes de centime. Le pire cas d'une heuristique fausse est
 * une réponse un peu moins fine, ou un peu plus chère, jamais une réponse fausse.
 *
 * Sa faiblesse est connue et assumée : « pourquoi » et « compare » attrapent bien les questions
 * d'analyse, mais une question d'analyse formulée platement (« et juillet ? ») partira sur le
 * petit modèle. C'est le sens de l'escalade : au premier signe que l'atelier trouve les réponses
 * courtes, on bascule le seuil, ou on met tout sur le grand modèle — le coût le permet.
 */
const MOTS_ANALYSE = [
  "pourquoi", "compare", "comparé", "comparaison", "par rapport", "écart", "evolution", "évolution",
  "analyse", "explique", "rentable", "rentabilité", "marge", "priorité", "prioritaire",
  "faut-il", "dois-je", "conseille", "mieux", "tendance", "progression", "baisse", "hausse",
];

export function choisirModele(question: string): string {
  const q = question.toLowerCase();
  if (question.length > 160) return MODELE_ANALYSE;
  return MOTS_ANALYSE.some((m) => q.includes(m)) ? MODELE_ANALYSE : MODELE_SIMPLE;
}
