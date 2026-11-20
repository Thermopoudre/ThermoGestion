import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { QUESTION_MAX, QUESTION_MIN, assistantConfigure, quotaDuJour } from "@/lib/assistant/config";
import { journaliser, questionsDuJour, quotaDepasse } from "@/lib/assistant/journal";
import { repondreFlux } from "@/lib/assistant/orchestration";
import { STATUT_HTTP, refusPourRole } from "@/lib/assistant/securite";
import type { ErreurAssistant } from "@/lib/assistant/types";

/**
 * La seule porte d'entrée de l'assistant.
 *
 * ─── CE QUI EST VÉRIFIÉ, ET DANS CET ORDRE ───────────────────────────────────────────────────
 *
 *  1. la session. Pas de session, pas de réponse — et surtout pas de client `service_role` : le
 *     client construit ici porte le cookie de l'utilisateur, donc toutes les lectures des outils
 *     passent par les mêmes politiques RLS que ses écrans. C'est le point unique dont dépend tout
 *     le cloisonnement ; si cette ligne changeait pour `createServiceClient()`, l'assistant
 *     deviendrait le seul endroit du produit capable de lire les données d'un autre atelier ;
 *  2. la configuration. Sans `ANTHROPIC_API_KEY`, on répond « assistant non configuré » en 503 —
 *     jamais un 500 anonyme, jamais un appel qui part sans clé ;
 *  3. la question. Bornée en longueur, et rien d'autre : on ne « nettoie » pas la question de ses
 *     mots suspects. Une question est une donnée, pas une instruction, et le seul rempart qui
 *     tienne contre une consigne glissée dedans est que le modèle n'a aucun moyen d'agir — pas
 *     de SQL, pas d'écriture, pas d'outil hors catalogue ;
 *  4. le plafond du jour, compté dans le journal de l'atelier.
 *
 * Aucun `atelier_id` n'est lu du corps de la requête : il n'y en a pas, et il ne faut pas qu'il y
 * en ait. L'atelier de l'appelant est déduit de sa session par la base.
 */

export const runtime = "nodejs";
// La réponse dépend entièrement de la session et de l'heure : jamais de cache.
export const dynamic = "force-dynamic";
// Quatre allers-retours modèle + outils : large, mais un timeout par défaut couperait la réponse
// au moment précis où elle allait s'afficher.
export const maxDuration = 60;

function erreur(e: ErreurAssistant, statut: number) {
  return NextResponse.json(e, { status: statut, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return erreur(
      { code: "non_authentifie", message: "Vous devez être connecté pour poser une question." },
      STATUT_HTTP.non_authentifie,
    );
  }

  if (!assistantConfigure()) {
    return erreur(
      {
        code: "assistant_non_configure",
        message:
          "L'assistant n'est pas activé sur ce serveur. Le reste de Thermogestion fonctionne " +
          "normalement : ouvrez /devis, /factures ou /pilotage.",
      },
      STATUT_HTTP.assistant_non_configure,
    );
  }

  const corps = (await req.json().catch(() => ({}))) as { question?: unknown };
  const question = typeof corps.question === "string" ? corps.question.trim() : "";
  if (question.length < QUESTION_MIN || question.length > QUESTION_MAX) {
    return erreur(
      {
        code: "question_invalide",
        message: `Posez une question de ${QUESTION_MIN} à ${QUESTION_MAX} caractères.`,
      },
      STATUT_HTTP.question_invalide,
    );
  }

  // Le rôle et la formule sont lus sous la session, comme partout ailleurs. Ils ne servent pas à
  // décider ce que la base rend — la RLS s'en charge — mais à décider quels outils sont même
  // PROPOSÉS au modèle, et à rendre le refus intelligible plutôt que muet.
  const { data: membre } = await supabase.from("users").select("role").maybeSingle();
  const { data: plan } = await supabase.rpc("mon_plan");
  const role = typeof membre?.role === "string" ? membre.role : null;
  const planEffectif = typeof plan === "string" ? plan : null;

  // Le plafond dépend de la formule (10 / 30 / 60 par jour, cf. `QUOTA_PAR_PLAN`) — le MÊME
  // barème que la fonction `plan_effectif()` en base, qui ouvre déjà `rentabilite` ou `qualite`.
  const plafond = quotaDuJour(planEffectif);
  const deja = await questionsDuJour(supabase);
  if (quotaDepasse(deja, plafond)) {
    return erreur(
      {
        code: "quota_atteint",
        message:
          `Votre atelier a posé ses ${plafond} questions du jour. Le compteur repart ` +
          "demain — en attendant, tout est consultable sur vos écrans.",
      },
      STATUT_HTTP.quota_atteint,
    );
  }

  // F6 — décision extraite dans `securite.ts` : c'est CETTE fonction, testée à froid sans session
  // ni base, qui décide seule si un rôle passe ou non. La route ne fait qu'appliquer son verdict.
  const refus = refusPourRole(role);
  if (refus) return erreur(refus, STATUT_HTTP[refus.code]);

  // F4 — le flux SSE. Tout ce qui précède est une réponse JSON normale, guichet par guichet ; à
  // partir d'ici, le corps de la réponse est un flux `text/event-stream` d'une ligne `data: …`
  // par événement (cf. `EvenementAssistant`), pour que le texte s'écrive au fil de l'eau plutôt
  // que d'un bloc après plusieurs secondes de silence.
  const encodeur = new TextEncoder();
  const flux = new ReadableStream<Uint8Array>({
    async start(controleur) {
      function envoyer(ligne: unknown) {
        controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(ligne)}\n\n`));
      }
      try {
        for await (const evt of repondreFlux({ question, sb: supabase, role, plan: planEffectif })) {
          if (evt.type === "erreur") {
            // Même règle qu'avant le passage au flux : un échec se journalise aussi, c'est ce
            // qu'on veut lire en premier quand on cherche pourquoi l'atelier a arrêté de s'en
            // servir.
            await journaliser(supabase, {
              question, outils: [], modele: null, cout_eur: 0, erreur: evt.erreur.code,
            });
            envoyer(evt);
            break;
          }
          if (evt.type === "fin") {
            await journaliser(supabase, {
              question,
              outils: evt.reponse.trace,
              modele: evt.reponse.modele,
              cout_eur: evt.reponse.cout_eur,
            });
            // Rendu à l'écran pour que le décompte soit visible AVANT le mur, pas au moment où
            // il tombe.
            envoyer({
              ...evt,
              reponse: { ...evt.reponse, quota: deja === null ? null : { pose: deja + 1, plafond } },
            });
            break;
          }
          envoyer(evt);
        }
      } catch (e) {
        // Un pépin dans la boucle elle-même (pas dans l'appel au modèle, déjà couvert par
        // `repondreFlux`) : le flux ne doit pas mourir en silence, l'écran doit recevoir un
        // message qu'il sait afficher.
        console.error("[assistant] flux interrompu", e);
        envoyer({
          type: "erreur",
          erreur: {
            code: "erreur_modele",
            message:
              "L'assistant n'a pas pu répondre pour le moment. Vos données n'ont pas été modifiées " +
              "— réessayez dans un instant, ou ouvrez l'écran concerné.",
          },
        });
      } finally {
        controleur.close();
      }
    },
  });

  return new Response(flux, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-store",
      Connection: "keep-alive",
      // Next.js (comme certains proxys) bufferise sinon la réponse et annule l'intérêt du flux.
      "X-Accel-Buffering": "no",
    },
  });
}
