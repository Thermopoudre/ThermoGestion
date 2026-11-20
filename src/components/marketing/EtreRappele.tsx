"use client";

import { useId, useState } from "react";
import { track, utm } from "@/lib/track";

/**
 * Demande de rappel — le seul point de capture de la vitrine.
 *
 * La table `leads` existait depuis des semaines avec sa colonne `utm` et n'avait jamais reçu une
 * ligne : pas faute de trafic, faute de formulaire. C'est le manque M1 de l'audit marketing, et il
 * pèse plus lourd que n'importe quelle requête du tableau de mots-clés — dans ce métier la vente
 * se fait au téléphone, et le concurrent le mieux référencé n'a qu'un seul appel à l'action sur
 * tout son site : « Demander une démo ».
 *
 * Seul l'e-mail est obligatoire. Chaque champ ajouté à un formulaire coûte des réponses, et un
 * exploitant d'atelier qui découvre le produit à 21 h ne remplira pas huit lignes.
 *
 * Les garde-fous (pot de miel, limite de débit, forme de l'e-mail) vivent dans `POST /api/leads`
 * et dans la policy PostgREST, pas ici : une validation de navigateur ne protège de rien.
 */

type Origine = "accueil" | "jantes" | "sous-traitance" | "tarifs";

type Props = {
  /** Reporté dans `leads.source` : sert à savoir laquelle des deux cibles a écrit. */
  origine: Origine;
  titre?: string;
  texte?: string;
};

type Etat = "saisie" | "envoi" | "envoye" | "erreur";

const CHAMPS = [
  { nom: "nom", label: "Votre nom", type: "text", autoComplete: "name", requis: false },
  { nom: "atelier_nom", label: "Votre atelier", type: "text", autoComplete: "organization", requis: false },
  { nom: "email", label: "Votre e-mail", type: "email", autoComplete: "email", requis: true },
  { nom: "telephone", label: "Votre téléphone", type: "tel", autoComplete: "tel", requis: false },
] as const;

export default function EtreRappele({ origine, titre, texte }: Props) {
  const [etat, setEtat] = useState<Etat>("saisie");
  const [erreur, setErreur] = useState("");
  const idBase = useId();

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (etat === "envoi") return;
    setEtat("envoi");
    setErreur("");

    const donnees = Object.fromEntries(new FormData(e.currentTarget).entries());

    try {
      const reponse = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...donnees, source: origine, utm: utm() }),
      });
      const corps = (await reponse.json().catch(() => ({}))) as { error?: string };
      if (!reponse.ok) {
        setErreur(corps.error ?? "L'envoi a échoué. Écrivez-nous à contact@thermopoudre.fr.");
        setEtat("erreur");
        return;
      }
      track("lead_submitted", { source: origine });
      setEtat("envoye");
    } catch {
      setErreur("Connexion impossible. Écrivez-nous directement à contact@thermopoudre.fr.");
      setEtat("erreur");
    }
  }

  return (
    <section id="rappel" className="bg-ink py-16 text-white">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {titre ?? "Vous préférez qu'on en parle de vive voix ?"}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center leading-relaxed text-zinc-300">
          {texte ??
            "Dites-nous en deux lignes ce que vous faites et comment vous le gérez aujourd'hui. On vous montre le logiciel sur votre propre cas, sans engagement et sans commercial."}
        </p>

        {etat === "envoye" ? (
          <div
            role="status"
            className="mx-auto mt-8 max-w-xl rounded-xl border border-tpblue/40 bg-tpblue/10 p-6 text-center"
          >
            <p className="font-display text-lg font-semibold">C&apos;est noté, merci.</p>
            <p className="mt-2 leading-relaxed text-zinc-300">
              On vous répond sous un jour ouvré. En attendant, la démonstration est ouverte :{" "}
              {/* Lien natif : /demo est une route serveur qui pose la session de démonstration. */}
              <a href="/demo" className="font-medium text-tpblue underline underline-offset-2">
                visiter l&apos;atelier de démonstration
              </a>.
            </p>
          </div>
        ) : (
          <form onSubmit={envoyer} className="mx-auto mt-8 max-w-xl" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              {CHAMPS.map((c) => (
                <div key={c.nom}>
                  <label htmlFor={`${idBase}-${c.nom}`} className="block text-sm font-medium text-zinc-300">
                    {c.label}
                    {c.requis && <span className="text-tpblue"> *</span>}
                  </label>
                  <input
                    id={`${idBase}-${c.nom}`}
                    name={c.nom}
                    type={c.type}
                    autoComplete={c.autoComplete}
                    required={c.requis}
                    className="mt-1.5 block min-h-[44px] w-full rounded-lg border border-ink-line bg-white/[0.06] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-tpblue focus:outline-none focus:ring-1 focus:ring-tpblue"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label htmlFor={`${idBase}-message`} className="block text-sm font-medium text-zinc-300">
                Ce que vous faites, et comment vous le gérez aujourd&apos;hui
              </label>
              <textarea
                id={`${idBase}-message`}
                name="message"
                rows={3}
                placeholder="Ex. : rénovation de jantes pour trois garages, tout sur un cahier et des photos dans le téléphone."
                className="mt-1.5 block w-full rounded-lg border border-ink-line bg-white/[0.06] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-tpblue focus:outline-none focus:ring-1 focus:ring-tpblue"
              />
            </div>

            {/* Pot de miel : invisible pour un humain, rempli par la plupart des robots. Masqué en
                CSS et non par `type=hidden`, qu'un robot sait reconnaître. */}
            <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label htmlFor={`${idBase}-societe-web`}>Site web de la société</label>
              <input id={`${idBase}-societe-web`} name="societe_web" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            {etat === "erreur" && (
              <p role="alert" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
                {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={etat === "envoi"}
              className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-tpblue px-7 py-3.5 font-display text-base font-semibold text-ink transition hover:bg-tpblue-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
            >
              {etat === "envoi" ? "Envoi…" : "Être rappelé"}
            </button>

            <p className="mt-4 text-center text-sm text-zinc-400">
              Ou{" "}
              <a href="/demo" className="font-medium text-tpblue underline underline-offset-2">
                visitez la démo tout de suite
              </a>{" "}
              — aucun compte, aucune carte. Vous pouvez aussi écrire à{" "}
              <a href="mailto:contact@thermopoudre.fr" className="font-medium text-tpblue underline underline-offset-2">
                contact@thermopoudre.fr
              </a>{" "}
              : c&apos;est l&apos;éditeur qui répond, pas un standard.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
