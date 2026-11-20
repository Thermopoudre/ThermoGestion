"use client";
import { useState } from "react";
import { Check, Phone } from "lucide-react";
import SelecteurLangue from "@/components/SelecteurLangue";
import { Badge } from "@/components/ui";
import { STATUS_PROJET } from "@/lib/utils";
import { dateL, textes, type Langue } from "@/lib/i18n";
import { SITE_URL } from "@/lib/env";

type Etape = { code: string; libelle: string; done_at?: string | null };

type Suivi = {
  numero: string | null;
  nom: string | null;
  status: string;
  etapes: Etape[];
  date_promise: string | null;
  atelier: { nom: string; logo_url: string | null; couleur: string | null; telephone: string | null };
};

/**
 * Les libellés d'étapes sont saisis par l'atelier (« Préparation / sablage »), on ne peut donc pas
 * les traduire ; les états du projet, eux, viennent de nous et sont traduits.
 */
const STATUT_IT: Record<string, string> = {
  en_attente: "In attesa",
  en_cours: "In corso",
  pret: "Pronto",
  livre: "Consegnato",
  annule: "Annullato",
};

export default function SuiviPublicClient({ data }: { data: Suivi }) {
  const [langue, setLangue] = useState<Langue>("fr");
  const t = textes(langue);

  const etapes = data.etapes ?? [];
  const doneCount = etapes.filter((e) => e.done_at).length;
  const tel = data.atelier?.telephone ?? null;
  const accent = data.atelier?.couleur || "#147085";
  const logo = data.atelier?.logo_url ?? null;
  const statut = STATUS_PROJET[data.status] ?? null;
  const statutLabel = langue === "it" ? STATUT_IT[data.status] ?? statut?.label : statut?.label;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* En-tête alignée sur les autres pages publiques : logo + nom de l'atelier en premier,
            c'est l'atelier que le client doit reconnaître, pas Thermogestion. */}
        <div className="mb-4 flex items-start gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-12 w-12 flex-none rounded object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-gray-500">{data.atelier.nom}</div>
            <h1 className="font-display text-xl font-bold tracking-tight text-gray-900">{t.suiviTitre}</h1>
          </div>
          <SelecteurLangue onChange={setLangue} />
        </div>

        {/* Statut en un coup d'œil : le client doit comprendre où en sont ses pièces sans
            avoir à lire toute la liste des étapes. */}
        {data.status === "pret" && (
          <div className="mb-4 rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 text-center text-sm font-semibold text-success-dark">
            {t.suiviPretes}
          </div>
        )}
        {data.status === "livre" && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-sm font-medium text-gray-600">
            {t.suiviLivrees}
          </div>
        )}
        {data.status === "annule" && (
          <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5 text-center text-sm font-medium text-danger-dark">
            {t.suiviAnnule}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-sm text-gray-500">{data.numero} · {data.nom}</div>
          {statut && <Badge tone={statut.ton}>{statutLabel}</Badge>}
        </div>

        <div className="mb-6 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${etapes.length ? (doneCount / etapes.length) * 100 : 0}%`, backgroundColor: accent }} />
        </div>

        <ol className="flex flex-col gap-3">
          {etapes.map((e, i) => {
            const isCurrent = !e.done_at && etapes.slice(0, i).every((x) => x.done_at);
            return (
              <li key={e.code} className="flex items-center gap-3">
                <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm ${e.done_at ? "bg-brand-light text-brand-dark" : isCurrent ? "bg-ink text-white" : "bg-gray-100 text-gray-500"}`}>
                  {e.done_at ? <Check size={16} aria-hidden /> : i + 1}
                </span>
                <div className="min-w-0">
                  <div className={`text-sm ${isCurrent ? "font-semibold text-gray-900" : "text-gray-500"}`}>{e.libelle}</div>
                  {e.done_at && <div className="text-xs text-gray-500">{dateL(e.done_at, langue)}</div>}
                  {isCurrent && <div className="text-xs font-medium" style={{ color: accent }}>{t.enCours}</div>}
                </div>
              </li>
            );
          })}
        </ol>

        {data.date_promise && (
          <p className="mt-6 text-center text-sm text-gray-500">
            {t.datePrevue} : <b className="text-gray-800">{dateL(data.date_promise, langue)}</b>
          </p>
        )}
        {tel && (
          <a
            href={`tel:${tel.replace(/\s/g, "")}`}
            className="mt-4 flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Phone size={15} aria-hidden />
            {t.appelerAtelier}
          </a>
        )}
      </div>
      <p className="mx-auto mt-6 max-w-md text-center text-xs text-gray-500">
        {t.propulsePar}{" "}
        <a href={`${SITE_URL}/?utm_source=suivi&utm_medium=footer`} className="font-medium text-brand underline underline-offset-2">Thermogestion</a>
      </p>
    </main>
  );
}
