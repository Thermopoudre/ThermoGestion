"use client";
import { useState } from "react";
import { Check, Phone } from "lucide-react";
import { track, utm } from "@/lib/track";

/**
 * Formulaire « Être rappelé » de la vitrine.
 *
 * Raison d'être : les deux seuls appels à l'action du site étaient « créer un compte » et
 * « visiter la démo ». Un exploitant d'atelier qui découvre le produit à 21 h ne crée pas un
 * compte — il veut qu'on le rappelle. La table `leads` existait, avec sa colonne `utm`, et aucun
 * code ne l'écrivait faute de formulaire.
 *
 * Composant autonome et sans dépendance à la mise en page : il se pose tel quel dans une section
 * claire ou sur le fond marine (`variante="sombre"`).
 *
 * Usage :
 *   <FormulaireRappel source="accueil" />
 *   <FormulaireRappel source="page-jantes" variante="sombre" titre="…" />
 */
export default function FormulaireRappel({
  source = "vitrine",
  variante = "clair",
  titre = "Vous préférez qu'on vous rappelle ?",
  sousTitre = "Laissez votre numéro : on vous montre le logiciel sur vos pièces et vos tarifs, en quinze minutes, sans engagement.",
}: {
  source?: string;
  variante?: "clair" | "sombre";
  titre?: string;
  sousTitre?: string;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");

  const sombre = variante === "sombre";
  const champ = sombre
    // `placeholder-zinc-400` et non 500 : sur le marine #11203A, le zinc-500 tombe à 3,37:1,
    // sous le minimum AA de 4,5:1. Le zinc-400 est à 6,36:1.
    ? "w-full rounded-lg border border-ink-line bg-ink-soft px-3 py-3 text-sm text-white placeholder-zinc-400 focus:border-tpblue focus:outline-none focus:ring-1 focus:ring-tpblue"
    : "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 placeholder-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
  const libelle = sombre ? "mb-1 block text-xs font-medium text-zinc-300" : "mb-1 block text-xs font-medium text-zinc-600";

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    const f = new FormData(e.currentTarget);
    try {
      const reponse = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nom: f.get("nom"),
          email: f.get("email"),
          telephone: f.get("telephone"),
          atelier_nom: f.get("atelier_nom"),
          message: f.get("message"),
          societe_web: f.get("societe_web"),
          source,
          utm: utm(),
        }),
      });
      const data = (await reponse.json()) as { ok?: boolean; error?: string };
      if (!reponse.ok || !data.ok) {
        setErreur(data.error ?? "L'envoi a échoué. Écrivez-nous à contact@thermopoudre.fr.");
        return;
      }
      track("lead_submitted", { source });
      setEnvoye(true);
    } catch {
      setErreur("Problème de connexion. Réessayez, ou écrivez-nous à contact@thermopoudre.fr.");
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) {
    return (
      <div className={`flex items-start gap-3 rounded-xl border p-6 ${sombre ? "border-tpblue/40 bg-tpblue/10 text-zinc-200" : "border-brand bg-brand-light text-ink"}`}>
        <Check size={22} aria-hidden className={sombre ? "mt-0.5 shrink-0 text-tpblue" : "mt-0.5 shrink-0 text-brand-dark"} />
        <div>
          <p className="font-display font-semibold">C&apos;est noté, on vous rappelle.</p>
          <p className="mt-1 text-sm">
            Sous un jour ouvré. En attendant, la démonstration est ouverte sans inscription — et si
            c&apos;est urgent, appelez-nous ou écrivez à contact@thermopoudre.fr.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className={`rounded-xl border p-6 ${sombre ? "border-ink-line bg-ink-soft" : "border-zinc-200 bg-white"}`}>
      <p className={`flex items-center gap-2 font-display text-lg font-semibold ${sombre ? "text-white" : "text-ink"}`}>
        <Phone size={18} aria-hidden className={sombre ? "text-tpblue" : "text-brand"} /> {titre}
      </p>
      <p className={`mt-1 text-sm ${sombre ? "text-zinc-400" : "text-zinc-600"}`}>{sousTitre}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={libelle}>Votre nom</span>
          <input name="nom" autoComplete="name" className={champ} />
        </label>
        <label className="block">
          <span className={libelle}>Nom de l&apos;atelier</span>
          <input name="atelier_nom" autoComplete="organization" className={champ} />
        </label>
        <label className="block">
          <span className={libelle}>Téléphone</span>
          <input name="telephone" type="tel" inputMode="tel" autoComplete="tel" className={champ} />
        </label>
        <label className="block">
          <span className={libelle}>E-mail *</span>
          <input name="email" type="email" required autoComplete="email" className={champ} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className={libelle}>Ce que vous faites, en une ligne (facultatif)</span>
        <input name="message" placeholder="Jantes alu et portails, deux personnes, on travaille sur un tableur" className={champ} />
      </label>

      {/* Pot de miel : invisible et hors du parcours clavier pour un humain, rempli par les
          robots de formulaire. Le serveur répond « enregistré » sans rien écrire. */}
      <input
        name="societe_web"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {erreur && <p className={`mt-3 text-sm ${sombre ? "text-amber-300" : "text-danger-dark"}`}>{erreur}</p>}

      <button
        type="submit"
        disabled={envoi}
        className={`mt-5 w-full rounded-lg px-6 py-3.5 font-display font-semibold transition duration-150 ease-out disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          sombre ? "bg-tpblue text-ink hover:bg-tpblue-soft focus-visible:outline-tpblue" : "bg-brand text-white hover:bg-brand-dark focus-visible:outline-brand"
        }`}
      >
        {envoi ? "Envoi…" : "Être rappelé"}
      </button>
      <p className={`mt-3 text-xs ${sombre ? "text-zinc-400" : "text-zinc-500"}`}>
        Vos coordonnées servent uniquement à vous rappeler. Elles ne sont ni revendues, ni utilisées
        pour autre chose. Voir la{" "}
        <a href="/legal/confidentialite" className={`underline underline-offset-2 ${sombre ? "text-zinc-300" : "text-brand-dark"}`}>
          politique de confidentialité
        </a>.
      </p>
    </form>
  );
}
