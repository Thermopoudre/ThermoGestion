"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { usePlan } from "@/components/PlanProvider";
import { cn, eur } from "@/lib/utils";
import type { ProjetRevient } from "@/lib/types";

type FactureLigne = { type: "acompte" | "solde" | "libre" | "avoir"; total_ht: number };

/**
 * Bandeau de prix de revient réel, discret, à insérer sur la fiche projet. Le revient (vue
 * `projet_revient`, déjà calculée en base) combine poudre consommée, main d'œuvre chronométrée
 * et quote-part d'énergie du four. Le "facturé" est la somme des factures réellement émises
 * (hors brouillon) rattachées au projet — c'est ce qui rend la marge lisible d'un coup d'œil.
 */
export default function RevientProjet({ projetId }: { projetId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [revient, setRevient] = useState<ProjetRevient | null>(null);
  const [facture, setFacture] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { ouvert } = usePlan();
  const rentabiliteOuverte = ouvert("rentabilite");

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: f }] = await Promise.all([
        supabase.from("projet_revient").select("*").eq("projet_id", projetId).maybeSingle(),
        supabase.from("factures").select("type, total_ht").eq("projet_id", projetId).in("status", ["emise", "payee"]),
      ]);
      setRevient(r as ProjetRevient | null);
      const lignes = (f as FactureLigne[]) ?? [];
      setFacture(lignes.length ? lignes.reduce((s, l) => s + (l.type === "avoir" ? -Number(l.total_ht) : Number(l.total_ht)), 0) : null);
      setLoaded(true);
    })();
  }, [projetId, supabase]);

  // La vue `projet_revient` ne rend aucune ligne hors formule Équipe : le bandeau disparaît donc
  // de lui-même. Le test explicite reste utile pour ne pas dépendre d'un effet de bord de la vue.
  if (!rentabiliteOuverte) return null;
  if (!loaded || !revient) return null;
  // Rien d'utile à montrer sur un projet qui vient d'être créé : ni coût, ni facture.
  if (revient.revient_total <= 0 && facture == null) return null;

  // C7 — la vue ajoute désormais `cout_non_qualite` (retouches/rebuts imputés au projet, y compris
  // la quote-part d'une non-conformité posée sur toute une fournée). Il faut le sortir du calcul
  // des frais généraux au même titre que poudre/main d'œuvre/énergie, sinon il gonflait silencieusement
  // cette ligne fourre-tout.
  const fraisGeneraux =
    Math.round(
      (Number(revient.revient_total) -
        Number(revient.cout_poudre) -
        Number(revient.cout_main_oeuvre) -
        Number(revient.cout_energie) -
        Number(revient.cout_non_qualite ?? 0)) *
        100,
    ) / 100;
  const marge = facture != null && facture > 0 ? Math.round(((facture - revient.revient_total) / facture) * 100) : null;
  const negative = marge != null && marge < 0;

  return (
    <Card
      className={negative ? "border-danger-light bg-danger-light/60" : undefined}
      onClick={() => setOpen((o) => !o)}
      ariaLabel={open ? "Masquer le détail du prix de revient" : "Afficher le détail du prix de revient"}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold">Revient {eur(revient.revient_total)}</span>
        <span className="text-gray-400">·</span>
        <span>Facturé {facture != null ? eur(facture) : "—"}</span>
        {marge != null && (
          <>
            <span className="text-gray-400">·</span>
            <span className={negative ? "font-semibold text-danger-dark" : "font-medium text-success-dark"}>Marge {marge} %</span>
          </>
        )}
        <ChevronDown size={14} aria-hidden className={cn("ml-auto text-gray-400 transition-transform duration-150 ease-out", open && "rotate-180")} />
      </div>
      {negative && <p className="mt-1 text-xs font-medium text-danger-dark">Ce projet coûte plus qu&apos;il ne rapporte.</p>}
      {open && (
        <div className="mt-2 grid grid-cols-5 gap-2 border-t border-gray-100 pt-2 text-xs">
          <div><div className="text-gray-500">Poudre</div><div className="font-medium">{eur(revient.cout_poudre)}</div></div>
          <div><div className="text-gray-500">Main d&apos;œuvre</div><div className="font-medium">{eur(revient.cout_main_oeuvre)}</div></div>
          <div><div className="text-gray-500">Énergie</div><div className="font-medium">{eur(revient.cout_energie)}</div></div>
          {/* C7 — non-qualité imputée à ce projet : retouches/rebuts directs, plus la quote-part
              d'une non-conformité posée sur toute une fournée (répartie au prorata des surfaces). */}
          <div><div className="text-gray-500">Non-qualité</div><div className="font-medium">{eur(revient.cout_non_qualite ?? 0)}</div></div>
          {/* Les frais généraux étaient déjà dans le total sans jamais être affichés : la somme des
              postes ne retombait pas sur le revient, ce qui donnait l'impression d'une erreur. */}
          <div><div className="text-gray-500">Frais généraux</div><div className="font-medium">{eur(fraisGeneraux)}</div></div>
        </div>
      )}
      {/* C7 — phrase obligatoire (cahier des charges v3 §3) : ce prix de revient n'a jamais inclus
          les consommables (masking, cellophane, etc.) ni les achats hors poudre. Elle doit rester
          identique mot pour mot ici et dans /pilotage (rentabilité). */}
      <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-400">
        Ce prix de revient ne comprend ni les consommables ni les achats hors poudre.
      </p>
    </Card>
  );
}
