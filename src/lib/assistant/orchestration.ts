import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JETONS_SORTIE_MAX, TOURS_MAX, cleApi, coutEnEuros,
} from "@/lib/assistant/config";
import { jourParis } from "@/lib/assistant/dates";
import { outilsPourRole, type OutilAssistant } from "@/lib/assistant/outils";
import { choisirModele, promptSysteme } from "@/lib/assistant/prompt";
import type {
  ActionProposee, EvenementAssistant, ReponseAssistant, ResultatOutil, SourceAssistant,
} from "@/lib/assistant/types";

/**
 * La boucle « le modèle demande, l'outil répond ».
 *
 * Elle vit côté serveur uniquement. Trois propriétés en font le cœur du dispositif de sécurité :
 *
 *  1. la liste des outils envoyée au modèle est calculée à partir du RÔLE de l'appelant, pas de
 *     ce que le modèle demande ;
 *  2. le nom d'outil rendu par le modèle est cherché dans cette liste ; un nom inconnu ne
 *     déclenche rien et revient au modèle comme une erreur — il n'existe aucun chemin par lequel
 *     une chaîne produite par le modèle atteigne la base ;
 *  3. les liens et les actions affichés sous la réponse sont fabriqués ICI, à partir des outils
 *     réellement appelés. Le modèle n'écrit jamais une URL : il ne peut donc pas envoyer
 *     l'exploitant vers une fiche qui n'est pas la sienne, ni inventer un numéro de devis
 *     cliquable qui n'existe pas.
 */

export type DemandeAssistant = {
  question: string;
  /** Client Supabase porteur de la SESSION de l'utilisateur. Jamais le client `service_role`. */
  sb: SupabaseClient;
  role: string | null;
  plan: string | null;
  maintenant?: Date;
};

/** Traduit un outil interne en déclaration d'outil pour l'API Messages. */
function declaration(o: OutilAssistant): Tool {
  return {
    name: o.nom,
    description: o.description,
    input_schema: o.parametres as Tool["input_schema"],
  };
}

/**
 * Les actions proposées sous la réponse, par outil appelé.
 *
 * Ce sont des CHEMINS D'ÉCRAN, pas des ordres. Ouvrir la liste des devis, ouvrir la liste des
 * factures, ouvrir le journal des relances : trois écrans qui existent déjà et dont les boutons
 * sont ceux que l'exploitant connaît. L'assistant amène devant le bouton ; il n'appuie pas.
 */
const ACTIONS_PAR_OUTIL: Record<string, ActionProposee[]> = {
  devis_sans_reponse: [
    { libelle: "Ouvrir mes devis", chemin: "/devis" },
    { libelle: "Voir les relances déjà parties", chemin: "/relances" },
  ],
  factures_echues: [
    { libelle: "Ouvrir mes factures", chemin: "/factures" },
    { libelle: "Voir les relances déjà parties", chemin: "/relances" },
  ],
  chiffre_affaires_periode: [{ libelle: "Ouvrir mes factures", chemin: "/factures" }],
  journee_du_matin: [{ libelle: "Ouvrir le pilotage", chemin: "/pilotage" }],
  devis_signes_non_produits: [
    { libelle: "Ouvrir mes devis", chemin: "/devis" },
    { libelle: "Ouvrir mes chantiers", chemin: "/projets" },
  ],
  pieces_pretes_non_livrees: [{ libelle: "Ouvrir mes chantiers", chemin: "/projets" }],
  agenda_dates_promises: [{ libelle: "Ouvrir mes chantiers", chemin: "/projets" }],
  clients_dormants: [{ libelle: "Ouvrir mes clients", chemin: "/clients" }],
  stock_sous_seuil: [{ libelle: "Ouvrir le stock", chemin: "/stock" }],
  rentabilite_client: [{ libelle: "Ouvrir le pilotage — Rentabilité client", chemin: "/pilotage?onglet=clients" }],
  rentabilite_projet: [{ libelle: "Ouvrir le pilotage — Rentabilité client", chemin: "/pilotage?onglet=clients" }],
};

/** Texte agrégé des blocs de type `text` d'une réponse. */
function texteDe(contenu: Anthropic.Messages.Message["content"]): string {
  return contenu
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * F4 — le prompt système ET le catalogue d'outils sont EXACTEMENT les mêmes pour les quarante
 * ateliers abonnés (cf. le commentaire d'en-tête de `prompt.ts`) : c'est le cas d'école du cache de
 * prompt d'Anthropic. Le point de coupure (`cache_control`) est posé sur le dernier bloc du
 * système et sur le dernier outil de la liste — tout ce qui précède ce point est mis en cache côté
 * Anthropic et refacturé au tarif réduit dès la question suivante du même rôle. Rien n'y est
 * spécifique à l'atelier : aucune donnée commerciale ne traverse donc la frontière du cache.
 */
const CACHE_EPHEMERE = { type: "ephemeral" as const };

/** Traduit un outil interne en déclaration d'outil pour l'API Messages, avec le point de cache. */
function declarationsAvecCache(outils: OutilAssistant[]): Tool[] {
  return outils.map((o, i) => ({
    ...declaration(o),
    ...(i === outils.length - 1 ? { cache_control: CACHE_EPHEMERE } : {}),
  }));
}

export async function* repondreFlux(d: DemandeAssistant): AsyncGenerator<EvenementAssistant> {
  const cle = cleApi();
  if (!cle) {
    yield {
      type: "erreur",
      erreur: {
        code: "assistant_non_configure",
        message:
          "L'assistant n'est pas configuré sur ce serveur. Aucune question ne peut être posée tant " +
          "que la clé d'API n'est pas renseignée.",
      },
    };
    return;
  }

  const maintenant = d.maintenant ?? new Date();
  const outils = outilsPourRole(d.role);
  const parNom = new Map(outils.map((o) => [o.nom, o]));
  const modele = choisirModele(d.question);
  const client = new Anthropic({ apiKey: cle });
  const tools = declarationsAvecCache(outils);

  const messages: MessageParam[] = [{ role: "user", content: d.question }];
  const resultats: ResultatOutil[] = [];
  let jetonsEntree = 0;
  let jetonsSortie = 0;
  let texte = "";

  for (let tour = 0; tour < TOURS_MAX; tour++) {
    // Au dernier tour, on retire les outils : le modèle N'A PLUS le choix, il doit rédiger avec ce
    // qu'il a. Sans ça, une boucle d'appels d'outils se terminerait sur une réponse vide et
    // l'exploitant verrait un écran blanc après avoir attendu.
    const dernierTour = tour === TOURS_MAX - 1;

    let reponse: Anthropic.Messages.Message;
    try {
      const flux = client.messages.stream({
        model: modele,
        max_tokens: JETONS_SORTIE_MAX,
        // Un seul bloc, avec son point de cache : le prompt entier (identique pour tous) tient
        // dans ce bloc, donc le point de coupure porte sur la totalité du texte système.
        system: [{ type: "text", text: promptSysteme({
          aujourdhui: jourParis(maintenant),
          role: d.role,
          plan: d.plan,
        }), cache_control: CACHE_EPHEMERE }],
        ...(dernierTour ? {} : { tools }),
        messages,
      });
      // Le texte part au fil de l'eau : c'est tout l'intérêt du flux SSE pour l'exploitant, qui
      // voit la réponse s'écrire au lieu de fixer un spinner pendant deux à trois secondes.
      for await (const evt of flux) {
        if (evt.type === "content_block_delta" && evt.delta.type === "text_delta") {
          yield { type: "texte", delta: evt.delta.text };
        }
      }
      reponse = await flux.finalMessage();
    } catch (e) {
      // On ne laisse jamais remonter l'erreur brute : elle peut contenir des en-têtes, et
      // l'exploitant n'a que faire d'un code HTTP. Le détail part dans les logs du serveur.
      console.error("[assistant] appel du modèle en échec", e);
      yield {
        type: "erreur",
        erreur: {
          code: "erreur_modele",
          message:
            "L'assistant n'a pas pu répondre pour le moment. Vos données n'ont pas été modifiées — " +
            "réessayez dans un instant, ou ouvrez l'écran concerné.",
        },
      };
      return;
    }

    jetonsEntree += reponse.usage.input_tokens;
    jetonsSortie += reponse.usage.output_tokens;

    const appels = reponse.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );

    if (reponse.stop_reason !== "tool_use" || appels.length === 0) {
      // Le texte déjà diffusé bloc par bloc EST la réponse finale : on le fige tel quel plutôt que
      // de le reconstruire, pour ne jamais afficher deux versions légèrement différentes.
      texte = texteDe(reponse.content);
      break;
    }

    messages.push({ role: "assistant", content: reponse.content });

    const retours: ToolResultBlockParam[] = [];
    for (const appel of appels) {
      const outil = parNom.get(appel.name);
      if (!outil) {
        // Nom inconnu : soit le modèle a halluciné, soit il a nommé un outil que son rôle ne lui
        // ouvre pas. Dans les deux cas on ne cherche pas plus loin, on le lui dit.
        retours.push({
          type: "tool_result",
          tool_use_id: appel.id,
          is_error: true,
          content: `L'outil « ${appel.name} » n'existe pas ou n'est pas ouvert à ce rôle.`,
        });
        continue;
      }
      yield { type: "outil", outil: outil.nom };
      const args = (appel.input ?? {}) as Record<string, unknown>;
      let resultat: ResultatOutil;
      try {
        resultat = await outil.executer({ sb: d.sb, maintenant }, args);
      } catch (e) {
        console.error(`[assistant] outil ${outil.nom} en échec`, e);
        resultat = {
          outil: outil.nom, parametres: args, definition: "", donnees: {}, sources: [],
          tronque: false, refus: "erreur_base",
          message: "Cette information n'a pas pu être lue.",
        };
      }
      resultats.push(resultat);
      retours.push({
        type: "tool_result",
        tool_use_id: appel.id,
        is_error: resultat.refus !== undefined,
        content: JSON.stringify(resultat),
      });
    }

    messages.push({ role: "user", content: retours });
  }

  // Sources : celles des outils, dédoublonnées, dans l'ordre où les outils les ont rendues.
  const vues = new Set<string>();
  const sources: SourceAssistant[] = [];
  for (const r of resultats) {
    for (const s of r.sources) {
      if (vues.has(s.id)) continue;
      vues.add(s.id);
      sources.push(s);
    }
  }

  // Actions : dédoublonnées par chemin, et seulement pour les outils qui ont réellement répondu.
  const chemins = new Set<string>();
  const actions: ActionProposee[] = [];
  for (const r of resultats) {
    if (r.refus) continue;
    for (const a of ACTIONS_PAR_OUTIL[r.outil] ?? []) {
      if (chemins.has(a.chemin)) continue;
      chemins.add(a.chemin);
      actions.push(a);
    }
  }

  const finale: ReponseAssistant = {
    texte:
      texte ||
      "Je n'ai pas su répondre à cette question. Ouvrez l'écran concerné : /devis pour les devis, " +
        "/factures pour les factures, /pilotage pour la charge et la rentabilité.",
    sources,
    actions,
    trace: resultats.map((r) => ({
      outil: r.outil,
      parametres: r.parametres,
      lignes: Number(r.donnees.nombre ?? r.sources.length),
    })),
    modele,
    cout_eur: coutEnEuros(modele, jetonsEntree, jetonsSortie),
  };
  // `quota` est complété par la route, qui seule connaît le compteur du jour ; `null` ici est
  // remplacé avant l'envoi au navigateur.
  yield { type: "fin", reponse: { ...finale, quota: null } };
}
