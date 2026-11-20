"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Lightbulb } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ASTUCES } from "@/lib/aide";

/**
 * Explication de première visite.
 *
 * Elle s'affiche dépliée à la première ouverture d'un écran. Une fois lue, elle ne disparaît plus :
 * elle se **replie** en une seule ligne cliquable, qui la rouvre.
 *
 * POURQUOI ce changement. Dépliée, la carte occupait 60 à 70 % du premier écran d'un téléphone,
 * sur douze écrans. Sur `/dashboard`, « À faire » — les projets en retard et les factures
 * impayées, c'est-à-dire la raison d'ouvrir le logiciel — n'apparaissait qu'après deux balayages.
 * Et l'ancien « J'ai compris » la faisait disparaître **définitivement** : l'opérateur qui voulait
 * la relire n'avait plus aucun moyen de le faire. Repliée, elle tient sur une ligne et se rouvre
 * d'un doigt.
 *
 * `order-last md:order-none` : sur mobile, l'astuce passe **après** le contenu de la page ; sur
 * bureau elle reprend sa place, où elle ne coûte rien. Les écrans qui l'accueillent sont des
 * `flex flex-col` ; celui qui ne l'est pas ignore simplement `order`, sans casse.
 *
 * Le « déjà lu » est porté par l'utilisateur en base (`users.aides_vues`) et pas par le
 * navigateur : la tablette de l'atelier est partagée, et un opérateur qui la prend après le chef
 * doit avoir droit à sa propre explication.
 *
 * Le repli en `localStorage` n'est pas un doublon de confort : sur l'atelier de démonstration,
 * toute écriture est refusée en base (`DEMO_LECTURE_SEULE`). Sans lui, le visiteur qui découvre le
 * produit reverrait la même carte dépliée à chaque navigation.
 */
export default function AstuceEcran({ cle }: { cle: keyof typeof ASTUCES }) {
  const astuce = ASTUCES[cle];
  /** `null` tant qu'on ne sait pas si l'astuce a déjà été lue : on n'affiche rien avant. */
  const [deplie, setDeplie] = useState<boolean | null>(null);

  useEffect(() => {
    if (!astuce) return;
    let vivant = true;
    (async () => {
      if (localStorage.getItem(`aide:${astuce.cle}`)) {
        if (vivant) setDeplie(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.from("users").select("aides_vues").maybeSingle();
      const vues: string[] = data?.aides_vues ?? [];
      if (vivant) setDeplie(!vues.includes(astuce.cle));
    })();
    return () => {
      vivant = false;
    };
  }, [astuce]);

  /** Marque l'astuce comme lue et la replie. Elle reste atteignable d'un appui. */
  async function marquerLue() {
    setDeplie(false);
    localStorage.setItem(`aide:${astuce.cle}`, "1");
    const supabase = createClient();
    const { data } = await supabase.from("users").select("id, aides_vues").maybeSingle();
    if (!data) return;
    const vues: string[] = data.aides_vues ?? [];
    if (vues.includes(astuce.cle)) return;
    // Échec silencieux assumé : sur la démonstration l'écriture est refusée, et le repli local
    // a déjà fait le travail. Rien à dire à l'utilisateur, rien à réessayer.
    await supabase.from("users").update({ aides_vues: [...vues, astuce.cle] }).eq("id", data.id);
  }

  if (!astuce || deplie === null) return null;

  const idContenu = `astuce-contenu-${astuce.cle}`;

  return (
    <aside
      aria-labelledby={`astuce-${astuce.cle}`}
      className={cn(
        "order-last mb-4 rounded-xl border border-brand/25 md:order-none",
        deplie ? "bg-brand-light/40 p-4" : "bg-white",
      )}
    >
      <h2 id={`astuce-${astuce.cle}`} className="sr-only">
        {astuce.titre}
      </h2>
      <button
        type="button"
        onClick={() => setDeplie(!deplie)}
        aria-expanded={deplie}
        aria-controls={idContenu}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-left font-display text-sm font-semibold text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Lightbulb size={15} aria-hidden className="flex-none" />
        <span className="min-w-0 flex-1 truncate">{astuce.titre}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn("flex-none text-brand transition-transform duration-150 ease-out", deplie && "rotate-180")}
        />
      </button>

      {deplie && (
        <div id={idContenu} className="px-3 pb-1">
          <p className="mt-1.5 text-sm leading-relaxed text-gray-700">{astuce.texte}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={marquerLue}
              className="min-h-[44px] rounded-lg bg-white px-3.5 text-xs font-semibold text-brand-dark shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              J&apos;ai compris
            </button>
            {astuce.tutoriel && (
              <Link
                href={`/aide/${astuce.tutoriel}`}
                className="rounded text-xs font-medium text-brand underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Voir le tutoriel complet
              </Link>
            )}
          </div>
          {/* Amélioration n°10 — aiguillage entre les deux circuits de réception (jantes /
              générique) : ni fusionnés ni expliqués nulle part avant. C'est un lien, pas un
              bouton : on ne bascule rien, on indique juste où continuer. */}
          {astuce.lienCroise && (
            <Link
              href={astuce.lienCroise.href}
              className="mt-2 block text-xs font-medium text-brand underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {astuce.lienCroise.libelle}
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
