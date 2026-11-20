"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, PageTitle, Spinner } from "@/components/ui";
import { eur } from "@/lib/utils";
import { etalonnageInfo } from "@/lib/qualite";
import { useTitreDocument } from "@/lib/titre";
import { certificationDeReference, statutCertification } from "@/lib/certificat";
import type { Certification, Instrument } from "@/lib/types";
import AstuceEcran from "@/components/AstuceEcran";

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Stats = {
  atelierNom: string;
  certification: Certification | null;
  /** Certifications actives dont l'échéance est passée ou proche : c'est ce qui invalide un audit. */
  certificationsAlerte: Certification[];
  controlesAujourdhui: number;
  nonConformesAujourdhui: number;
  tauxConformite7j: number | null;
  ncs30j: number;
  coutNc30j: number;
  instrumentsRetard: number;
  instrumentsBientot: number;
  bainsTotal: number;
  bainsAujourdhui: number;
};

export default function QualitePage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const aujourdHui = isoDate(new Date());
      const debutAujourdhui = `${aujourdHui}T00:00:00`;
      const depuis7j = new Date(Date.now() - 7 * 86400000).toISOString();
      const depuis30j = new Date(Date.now() - 30 * 86400000).toISOString();

      const [atelier, controlesJour, controles7j, ncs30j, instruments, bains30j, certifs] = await Promise.all([
        supabase.from("ateliers").select("nom").maybeSingle(),
        supabase.from("controles").select("conforme").gte("mesure_at", debutAujourdhui),
        supabase.from("controles").select("conforme").gte("mesure_at", depuis7j),
        supabase.from("non_conformites").select("cout_estime").gte("detectee_at", depuis30j),
        supabase.from("instruments").select("*").eq("actif", true),
        supabase.from("controles_bains").select("bain, mesure_at").gte("mesure_at", depuis30j),
        supabase.from("certifications").select("*").eq("actif", true),
      ]);

      const c7 = controles7j.data ?? [];
      const conformes7 = c7.filter((c) => c.conforme === true).length;
      const decides7 = c7.filter((c) => c.conforme !== null).length;

      const instrs = (instruments.data as Instrument[]) ?? [];
      let retard = 0, bientot = 0;
      for (const i of instrs) {
        const info = etalonnageInfo(i.dernier_etalonnage, i.periodicite_mois);
        if (info.statut === "retard" || info.statut === "jamais") retard++;
        else if (info.statut === "bientot") bientot++;
      }

      const bains = bains30j.data ?? [];
      const bainsDistincts = new Set(bains.map((b) => b.bain));
      const bainsAuj = new Set(bains.filter((b) => (b.mesure_at as string).slice(0, 10) === aujourdHui).map((b) => b.bain));

      const certifications = (certifs.data as Certification[]) ?? [];

      setStats({
        atelierNom: atelier.data?.nom ?? "",
        certification: certificationDeReference(certifications),
        certificationsAlerte: certifications.filter((c) => ["bientot", "expiree"].includes(statutCertification(c.expire_le).statut)),
        controlesAujourdhui: controlesJour.data?.length ?? 0,
        nonConformesAujourdhui: (controlesJour.data ?? []).filter((c) => c.conforme === false).length,
        tauxConformite7j: decides7 > 0 ? Math.round((conformes7 / decides7) * 100) : null,
        ncs30j: ncs30j.data?.length ?? 0,
        coutNc30j: (ncs30j.data ?? []).reduce((s, nc) => s + (nc.cout_estime ?? 0), 0),
        instrumentsRetard: retard,
        instrumentsBientot: bientot,
        bainsTotal: bainsDistincts.size,
        bainsAujourdhui: bainsAuj.size,
      });
    })();
  }, []);

  useTitreDocument("Qualité");

  if (!stats) return <Spinner />;

  const debutMois = new Date();
  debutMois.setDate(1);
  const from = isoDate(debutMois);
  const to = isoDate(new Date());

  const alertes: { texte: string; href: string }[] = [];
  for (const c of stats.certificationsAlerte) {
    const { statut, joursRestants } = statutCertification(c.expire_le);
    alertes.push({
      texte: statut === "expiree"
        ? `Certification ${c.label} expirée — elle n'est plus imprimée sur vos documents`
        : `Certification ${c.label} à renouveler dans ${joursRestants} jour${(joursRestants ?? 0) > 1 ? "s" : ""}`,
      href: "/qualite/certifications",
    });
  }
  if (stats.instrumentsRetard > 0) alertes.push({ texte: `${stats.instrumentsRetard} instrument${stats.instrumentsRetard > 1 ? "s" : ""} à étalonner en urgence`, href: "/qualite/instruments" });
  if (stats.instrumentsBientot > 0) alertes.push({ texte: `${stats.instrumentsBientot} instrument${stats.instrumentsBientot > 1 ? "s" : ""} à étalonner bientôt`, href: "/qualite/instruments" });
  if (stats.nonConformesAujourdhui > 0) alertes.push({ texte: `${stats.nonConformesAujourdhui} contrôle${stats.nonConformesAujourdhui > 1 ? "s" : ""} non conforme${stats.nonConformesAujourdhui > 1 ? "s" : ""} aujourd'hui`, href: "/qualite/controles" });
  if (stats.bainsTotal > 0 && stats.bainsAujourdhui < stats.bainsTotal) alertes.push({ texte: `${stats.bainsAujourdhui}/${stats.bainsTotal} bains contrôlés aujourd'hui`, href: "/qualite/bains" });

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Qualité</PageTitle>
      <AstuceEcran cle="qualite" />
      <div className="-mt-2 text-sm text-gray-600">
        {stats.atelierNom} ·{" "}
        {stats.certification ? (
          <>
            {stats.certification.label}
            {stats.certification.expire_le && <span className="text-gray-400"> jusqu&apos;au {new Date(stats.certification.expire_le).toLocaleDateString("fr-FR")}</span>}
          </>
        ) : (
          <Link href="/qualite/certifications" className="underline">Aucune certification enregistrée</Link>
        )}
      </div>

      {alertes.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="mb-1 text-sm font-semibold text-amber-900">À traiter</div>
          <ul className="flex flex-col gap-1 text-sm text-amber-800">
            {alertes.map((a) => (
              <li key={a.texte}><Link href={a.href} className="underline">{a.texte}</Link></li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/qualite/controles"><Card><div className="text-2xl font-bold">{stats.controlesAujourdhui}</div><div className="text-xs text-gray-500">Contrôles aujourd&apos;hui</div></Card></Link>
        <Card>
          <div className="text-2xl font-bold">{stats.tauxConformite7j !== null ? `${stats.tauxConformite7j}%` : "—"}</div>
          <div className="text-xs text-gray-500">Taux de conformité (7 j)</div>
        </Card>
        <Link href="/qualite/non-conformites"><Card className={stats.ncs30j ? "border-amber-300 bg-amber-50" : ""}><div className="text-2xl font-bold">{stats.ncs30j}</div><div className="text-xs text-gray-500">Non-conformités (30 j)<br />{eur(stats.coutNc30j)}</div></Card></Link>
        <Link href="/qualite/instruments"><Card className={stats.instrumentsRetard ? "border-red-300 bg-red-50" : ""}><div className="text-2xl font-bold">{stats.instrumentsRetard}</div><div className="text-xs text-gray-500">Instruments en retard d&apos;étalonnage</div></Card></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:max-w-xl">
        <Link href="/qualite/controles" className="rounded-xl bg-brand p-4 text-center font-medium text-white">+ Contrôle</Link>
        <Link href="/qualite/bains" className="rounded-xl border border-gray-300 bg-white p-4 text-center font-medium">Registre des bains</Link>
        <Link href="/qualite/non-conformites" className="rounded-xl border border-gray-300 bg-white p-4 text-center font-medium">Non-conformités</Link>
        <Link href="/qualite/instruments" className="rounded-xl border border-gray-300 bg-white p-4 text-center font-medium">Instruments</Link>
        <Link href="/qualite/certifications" className="rounded-xl border border-gray-300 bg-white p-4 text-center font-medium">Certifications</Link>
        <Link href="/qualite/referentiels" className="rounded-xl border border-gray-300 bg-white p-4 text-center font-medium">Référentiels &amp; seuils</Link>
      </div>

      {/* Le second volet réglementaire, à côté de Qualicoat : ICPE 2940 et risque chimique. */}
      <div>
        <div className="mb-2 text-sm font-semibold text-gray-700">Environnement &amp; sécurité</div>
        <div className="grid grid-cols-2 gap-3 md:max-w-xl">
          <Link href="/qualite/dechets" className="rounded-xl border border-gray-300 bg-white p-4 text-center font-medium">Registre des déchets</Link>
          <Link href="/qualite/fds" className="rounded-xl border border-gray-300 bg-white p-4 text-center font-medium">Fiches de sécurité (FDS)</Link>
        </div>
      </div>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Registre des contrôles (PDF)</div>
          <div className="text-xs text-gray-500">Le document que l&apos;auditeur réclame — export du mois en cours.</div>
        </div>
        <a
          href={`/api/pdf/registre-controles?from=${from}&to=${to}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white"
        >
          Exporter
        </a>
      </Card>
    </div>
  );
}
