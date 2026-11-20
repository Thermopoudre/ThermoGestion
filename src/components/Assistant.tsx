"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, Send } from "lucide-react";
import { Button, Card, Spinner } from "@/components/ui";
import { eur, nombreFr } from "@/lib/utils";
// Un seul import côté assistant, et il est volontairement pauvre : `types.ts` ne contient ni le
// SDK Anthropic, ni le client Supabase, ni la moindre variable d'environnement. C'est la barrière
// qui garantit que rien de serveur ne part dans le paquet du navigateur.
import {
  LIBELLE_OUTIL, QUESTIONS_SUGGEREES, cheminSource,
  type ActionProposee, type EvenementAssistant, type ReponseAssistant, type SourceAssistant,
} from "@/lib/assistant/types";

/**
 * Le panneau « Demander ».
 *
 * Monté en tête de `/pilotage` (replié), et atteignable depuis la palette ⌘K quand une recherche
 * ne rend rien (voir `RechercheGlobale.tsx`).
 *
 * ─── LES QUATRE PARTIS PRIS D'INTERFACE ──────────────────────────────────────────────────────
 *
 *  1. LE CHIFFRE, PUIS SES PIÈCES. La réponse rédigée tient en quelques lignes ; dessous, la liste
 *     des fiches qui la fondent, chacune cliquable. Un exploitant qui ne peut pas ouvrir la pièce
 *     ne croira jamais le chiffre, et il aura raison.
 *
 *  2. LES ACTIONS SONT DES LIENS. Aucun bouton de ce composant n'écrit quoi que ce soit : ce sont
 *     des `Link` vers des écrans qui existent. On ne relance pas « depuis l'assistant » — on ouvre
 *     l'écran des devis, et on relance là où on a toujours relancé, avec les mêmes garde-fous.
 *
 *  3. LA TRACE EST VISIBLE, PAS CACHÉE. Un dépliant « Ce qui a été consulté » liste les outils
 *     appelés et leurs paramètres. C'est la réponse concrète à « qu'est-ce qui part chez le
 *     modèle ? » — et c'est aussi ce qui permet de repérer qu'une réponse a compté sur sept jours
 *     quand la question en disait dix.
 *
 *  4. LE TEXTE S'ÉCRIT AU FIL DE L'EAU (F4). La route répond en flux SSE : le texte de la réponse
 *     s'affiche mot après mot au lieu d'un bloc après plusieurs secondes de spinner.
 */

type Etat =
  | { phase: "repos" }
  | { phase: "attente" }
  | { phase: "ecriture"; texte: string; outil: string | null }
  | { phase: "reponse"; r: ReponseAssistant & { quota?: { pose: number; plafond: number } | null } }
  | { phase: "erreur"; message: string };

/** Découpe un flux SSE en événements `data: …` complets, et rend le reste non consommé. */
function evenementsSse(tampon: string): { evenements: EvenementAssistant[]; reste: string } {
  const blocs = tampon.split("\n\n");
  const reste = blocs.pop() ?? "";
  const evenements: EvenementAssistant[] = [];
  for (const bloc of blocs) {
    const ligne = bloc.split("\n").find((l) => l.startsWith("data: "));
    if (!ligne) continue;
    try {
      evenements.push(JSON.parse(ligne.slice("data: ".length)) as EvenementAssistant);
    } catch {
      // Un bloc mal formé ne doit pas casser tout le flux : on le passe, silencieusement — il n'y
      // a rien d'actionnable à faire d'un fragment JSON invalide côté navigateur.
    }
  }
  return { evenements, reste };
}

/**
 * `questionPrereplie` : utilisé par la bascule ⌘K (`RechercheGlobale.tsx`) quand une recherche ne
 * rend rien — le motif tapé arrive tout prêt dans le champ, prêt à être complété en question plutôt
 * que ressaisi. Jamais envoyé automatiquement : un motif de recherche n'est pas forcément une
 * question formée, et l'exploitant garde la main sur l'envoi.
 */
export default function Assistant({ questionPrereplie }: { questionPrereplie?: string } = {}) {
  const [question, setQuestion] = useState(questionPrereplie ?? "");
  const [etat, setEtat] = useState<Etat>({ phase: "repos" });
  const [traceOuverte, setTraceOuverte] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (questionPrereplie) champ.current?.focus();
    // Un seul remplissage, à l'ouverture : on ne veut pas écraser ce que l'exploitant a déjà tapé
    // si le composant se re-rend pour une autre raison.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function demander(q: string) {
    const texte = q.trim();
    if (texte.length < 3) return;
    setEtat({ phase: "attente" });
    setTraceOuverte(false);
    try {
      const rep = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: texte }),
      });

      // Les refus posés AVANT le flux (pas de session, quota atteint, assistant non configuré…)
      // restent du JSON classique — c'est le SEUL cas où la route ne répond pas en SSE.
      if (!rep.headers.get("content-type")?.includes("text/event-stream")) {
        const corps = await rep.json().catch(() => null);
        // Le serveur rend toujours un message écrit pour l'exploitant : on l'affiche tel quel
        // plutôt que d'inventer un « une erreur est survenue » qui n'apprend rien. Tant que la
        // clé du modèle n'est pas renseignée côté serveur (l'état actuel de la production), c'est
        // ce chemin qui s'exécute : un message clair, jamais une exception.
        setEtat({ phase: "erreur", message: corps?.message ?? "L'assistant n'a pas pu répondre." });
        return;
      }

      const lecteur = rep.body?.getReader();
      if (!lecteur) {
        setEtat({ phase: "erreur", message: "Connexion perdue. Réessayez." });
        return;
      }
      const decodeur = new TextDecoder();
      let tampon = "";
      let texteAccumule = "";
      let outilEnCours: string | null = null;

      for (;;) {
        const { value, done } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const { evenements, reste } = evenementsSse(tampon);
        tampon = reste;

        for (const evt of evenements) {
          if (evt.type === "texte") {
            texteAccumule += evt.delta;
            setEtat({ phase: "ecriture", texte: texteAccumule, outil: outilEnCours });
          } else if (evt.type === "outil") {
            outilEnCours = LIBELLE_OUTIL[evt.outil] ?? evt.outil;
            setEtat({ phase: "ecriture", texte: texteAccumule, outil: outilEnCours });
          } else if (evt.type === "fin") {
            setEtat({ phase: "reponse", r: evt.reponse });
          } else if (evt.type === "erreur") {
            setEtat({ phase: "erreur", message: evt.erreur.message });
          }
        }
      }
    } catch {
      setEtat({
        phase: "erreur",
        message: "Connexion perdue. Vos données n'ont pas été modifiées : réessayez.",
      });
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion size={18} className="text-brand" aria-hidden />
        <h2 className="text-sm font-semibold">Demander</h2>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void demander(question); }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="assistant-question" className="sr-only">
          Votre question sur vos devis, vos factures ou votre chiffre d&apos;affaires
        </label>
        <textarea
          id="assistant-question"
          ref={champ}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie, Maj+Entrée passe à la ligne : c'est la convention de tous les champs
            // de message, et le pouce d'un exploitant debout ne cherche pas un bouton.
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void demander(question); }
          }}
          rows={2}
          maxLength={500}
          placeholder="Quels devis n'ont pas de réponse depuis dix jours ?"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Réponses construites sur vos données, avec le lien vers chaque pièce.
          </p>
          <Button type="submit" loading={etat.phase === "attente"} disabled={question.trim().length < 3}>
            <Send size={16} aria-hidden /> Demander
          </Button>
        </div>
      </form>

      {etat.phase === "repos" && (
        <div className="flex flex-wrap gap-2">
          {QUESTIONS_SUGGEREES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setQuestion(s); void demander(s); }}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {etat.phase === "attente" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner taille="sm" /> Je regarde dans vos données…
        </div>
      )}

      {etat.phase === "ecriture" && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
          {etat.texte
            ? <p className="whitespace-pre-line text-sm leading-relaxed text-gray-900">{etat.texte}</p>
            : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spinner taille="sm" />
                {etat.outil ? `Je consulte : ${etat.outil}…` : "Je regarde dans vos données…"}
              </div>
            )}
        </div>
      )}

      {etat.phase === "erreur" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {etat.message}
        </div>
      )}

      {etat.phase === "reponse" && (
        <Reponse
          r={etat.r}
          traceOuverte={traceOuverte}
          basculerTrace={() => setTraceOuverte((v) => !v)}
        />
      )}
    </Card>
  );
}

function Reponse({
  r, traceOuverte, basculerTrace,
}: {
  r: ReponseAssistant & { quota?: { pose: number; plafond: number } | null };
  traceOuverte: boolean;
  basculerTrace: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
      {/* `whitespace-pre-line` : le modèle écrit des retours à la ligne, pas du HTML. On n'affiche
          jamais son texte en `dangerouslySetInnerHTML` — ce serait ouvrir une injection dans le
          seul endroit du produit où du texte non maîtrisé s'affiche. */}
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-900">{r.texte}</p>

      {r.sources.length > 0 && <Sources sources={r.sources} />}
      {r.actions.length > 0 && <Actions actions={r.actions} />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
        <button
          type="button"
          onClick={basculerTrace}
          className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {traceOuverte ? "Masquer" : "Voir"} ce qui a été consulté
        </button>
        {r.quota && <span>{r.quota.pose} / {r.quota.plafond} questions aujourd&apos;hui</span>}
      </div>

      {traceOuverte && (
        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <p className="mb-2">
            Votre question et les lignes ci-dessous sont les seules choses transmises au modèle.
            Aucune donnée d&apos;un autre atelier n&apos;y figure, et rien n&apos;a été modifié
            dans vos dossiers.
          </p>
          <ul className="flex flex-col gap-1">
            {r.trace.length === 0 && <li>Aucune donnée n&apos;a été lue : la réponse ne repose sur rien.</li>}
            {r.trace.map((t, i) => (
              <li key={i}>
                <span className="font-medium">{LIBELLE_OUTIL[t.outil] ?? t.outil}</span>
                {" — "}
                {Object.entries(t.parametres).map(([k, v]) => `${k} : ${String(v)}`).join(", ") || "sans filtre"}
                {" → "}
                {t.lignes} ligne{t.lignes > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
          {/* D6 — `toFixed(4)` rend un point anglo-saxon (« 0.0075 € »). */}
          <p className="mt-2">Modèle : {r.modele} · coût de cette question : {nombreFr(r.cout_eur, 4)} €</p>
        </div>
      )}
    </div>
  );
}

function Sources({ sources }: { sources: SourceAssistant[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-gray-500">Les pièces concernées</div>
      <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
        {sources.map((s) => (
          <li key={s.id}>
            <Link
              href={cheminSource(s)}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">{s.libelle}</span>
                {s.detail && <span className="block truncate text-xs text-gray-500">{s.detail}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-gray-900">
                {s.montant != null && eur(s.montant)}
                <ArrowRight size={14} className="text-gray-400" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Actions({ actions }: { actions: ActionProposee[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link
          key={a.chemin}
          href={a.chemin}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {a.libelle}
        </Link>
      ))}
    </div>
  );
}
