"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";
import {
  avertissementsCertificat,
  blocagesCertificat,
  certificationDeReference,
  type AvertissementCertificat,
  type BlocageCertificat,
} from "@/lib/certificat";
import { TYPE_CONTROLE_LABEL, typesControleActifs } from "@/lib/qualite";
import { typesNonAttestes } from "@/lib/certificat";
import type { Certification, Controle, ControleType, Fournee, Instrument, ReferentielQualite } from "@/lib/types";

/**
 * Le certificat de conformité engage l'atelier par écrit. Plutôt que de laisser l'opérateur
 * cliquer pour tomber sur un refus, l'écran annonce d'avance ce qui manque — et la route PDF
 * refait exactement le même contrôle côté serveur, parce qu'une règle qui n'existe que dans
 * React n'est pas une règle.
 */
export default function CertificatProjet({ projetId }: { projetId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [etat, setEtat] = useState<{
    blocages: BlocageCertificat[];
    avertissements: AvertissementCertificat[];
    nonAttestes: ControleType[];
    // L'atelier délivre-t-il réellement des certificats ? Déduit de la donnée (une certification
    // déclarée, ou un contrôle déjà saisi sur ce dossier) plutôt que d'un réglage de plus.
    concerne: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: projet }, { data: controles }, { data: instruments }, { data: liens }, { data: certifs }, { data: ref }] = await Promise.all([
        supabase.from("projets").select("lot_id, poudre_lots:lot_id(numero)").eq("id", projetId).maybeSingle(),
        supabase.from("controles").select("*").eq("projet_id", projetId),
        supabase.from("instruments").select("*"),
        supabase.from("fournee_projets").select("fournees(*)").eq("projet_id", projetId),
        supabase.from("certifications").select("*").eq("actif", true),
        supabase.from("referentiels_qualite").select("*").eq("actif", true).order("par_defaut", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const fournees = (((liens as unknown as { fournees: Fournee }[]) ?? []).map((l) => l.fournees)).filter(Boolean);
      const certification = certificationDeReference((certifs as Certification[]) ?? []);
      const ctx = {
        controles: (controles as unknown as Controle[]) ?? [],
        instruments: (instruments as Instrument[]) ?? [],
        fournees,
        lotNumero: (projet as unknown as { poudre_lots: { numero: string } | null } | null)?.poudre_lots?.numero ?? null,
        certificationExpireLe: certification?.expire_le ?? null,
        certificationLabel: certification?.label ?? null,
        typesActifs: typesControleActifs(ref as ReferentielQualite | null),
      };
      setEtat({
        blocages: blocagesCertificat(ctx),
        avertissements: avertissementsCertificat(ctx),
        nonAttestes: typesNonAttestes(ctx),
        concerne: ctx.controles.length > 0 || ((certifs as Certification[]) ?? []).length > 0,
      });
    })();
  }, [projetId, supabase]);

  if (!etat) return null;
  const emettable = etat.blocages.length === 0;
  // Replié tant que rien n'indique que l'atelier certifie : sur la fiche projet, ce bloc était le
  // premier sous le titre et affichait un pavé rouge « Pas encore certifiable » au-dessus du
  // bouton qui sert à travailler. Un atelier de trois personnes n'émet pas de certificat.
  const ouvert = emettable || etat.concerne;

  return (
    <Card className="p-0">
      <details open={ouvert} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
          <ChevronRight size={16} aria-hidden className="shrink-0 text-gray-400 transition-transform duration-150 ease-out group-open:rotate-90" />
          Certificat de conformité
          {!ouvert && <span className="ml-auto text-xs font-normal text-gray-500">non requis sur ce dossier</span>}
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500">
            Teinte, lot de poudre, épaisseurs mesurées, cycle de cuisson, label et garantie — le document
            qu&apos;un industriel ou une collectivité réclame à la livraison.
          </div>
        </div>
        {emettable ? (
          <a
            href={`/api/pdf/certificat/${projetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white"
          >
            Générer
          </a>
        ) : (
          // D9 — un `<span>` grisé n'est ni focusable, ni annoncé par un lecteur d'écran, et ne
          // dit pas pourquoi il est éteint. `disabled` porte la raison en `title` ; le détail
          // reste affiché juste en dessous (« Pas encore certifiable ») pour qui voit l'écran.
          <Button type="button" disabled className="shrink-0" title={etat.blocages.map((b) => b.message).join(" · ")}>
            Générer
          </Button>
        )}
      </div>

      {!emettable && (
        <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
          <div className="font-semibold">Pas encore certifiable</div>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
            {etat.blocages.map((b) => <li key={b.code}>{b.message}</li>)}
          </ul>
        </div>
      )}

      {emettable && etat.nonAttestes.length > 0 && (
        <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          Le certificat n&apos;attestera pas : {etat.nonAttestes.map((t) => TYPE_CONTROLE_LABEL[t]).join(", ").toLowerCase()} —
          ces contrôles n&apos;ont pas été réalisés sur ce dossier, le document le dira explicitement.
        </p>
      )}

      {etat.avertissements.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          <ul className="flex list-disc flex-col gap-0.5 pl-4">
            {etat.avertissements.map((a) => (
              <li key={a.code}>
                {a.message}
                {a.code !== "sans_lot" && <> <Link href="/qualite/certifications" className="underline">Gérer mes certifications</Link></>}
              </li>
            ))}
          </ul>
        </div>
      )}
        </div>
      </details>
    </Card>
  );
}
