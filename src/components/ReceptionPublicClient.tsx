"use client";
import { useState } from "react";
import SelecteurLangue from "@/components/SelecteurLangue";
import { dateHeureL, textes, type Langue } from "@/lib/i18n";
import { SITE_URL } from "@/lib/env";

type PublicReception = {
  numero: string | null;
  nb_pieces: number;
  designation: string | null;
  etat_constate: string;
  reserves: string | null;
  depose_par: string | null;
  signed_at: string | null;
  signature: { image?: string } | null;
  created_at: string;
  client: { nom: string };
  atelier: { nom: string; logo_url: string | null; couleur: string | null; telephone: string | null; email: string | null };
};

export default function ReceptionPublicClient({ reception, photos }: { reception: PublicReception; photos: string[] }) {
  const [langue, setLangue] = useState<Langue>("fr");
  const t = textes(langue);
  const a = reception.atelier;
  const accent = a.couleur || "#147085";

  return (
    <main className="mx-auto max-w-2xl p-4 print:p-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {a.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.logo_url} alt="" className="h-12 w-12 flex-none rounded object-contain" />
          )}
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-900">{a.nom}</div>
            <div className="text-xs text-gray-500">{[a.telephone, a.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <SelecteurLangue onChange={setLangue} />
          <button
            onClick={() => window.print()}
            aria-label={t.imprimerAria}
            className="flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand print:hidden"
          >
            {t.imprimer}
          </button>
        </div>
      </div>

      <h1 className="text-xl font-bold" style={{ color: accent }}>{t.bonReception} {reception.numero}</h1>
      <p className="mb-4 text-sm text-gray-500">{t.piecesRecuesLe} {dateHeureL(reception.created_at, langue)}</p>

      <div className="mb-4 rounded bg-gray-50 p-3 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">{t.deposePar}</div>
        <div className="font-medium">{reception.client.nom}</div>
        {reception.depose_par && <div className="text-gray-600">{t.remisPar} {reception.depose_par}</div>}
      </div>

      <dl className="mb-4 divide-y divide-gray-100 text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-gray-500">{t.nbPieces}</dt>
          <dd className="font-medium">{reception.nb_pieces}</dd>
        </div>
        {reception.designation && (
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-gray-500">{t.designation}</dt>
            <dd className="text-right font-medium">{reception.designation}</dd>
          </div>
        )}
        <div className="flex justify-between py-2">
          <dt className="text-gray-500">{t.etatConstate}</dt>
          <dd className="font-medium">{t.etats[reception.etat_constate] ?? reception.etat_constate}</dd>
        </div>
      </dl>

      {reception.reserves && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">{t.reserves}</div>
          <p className="whitespace-pre-wrap text-sm text-amber-900">{reception.reserves}</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 text-sm font-semibold">{t.photosReception}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="aspect-square rounded-lg object-cover" />
            ))}
          </div>
        </div>
      )}

      {reception.signature?.image && (
        <div className="mb-6">
          <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
            {t.signatureDeposant}{reception.depose_par ? ` — ${reception.depose_par}` : ""}
            {reception.signed_at ? ` · ${dateHeureL(reception.signed_at, langue)}` : ""}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reception.signature.image} alt={t.signatureDeposant} className="h-24 w-full max-w-xs rounded border border-gray-200 bg-white object-contain" />
        </div>
      )}

      <p className="mb-6 text-[11px] leading-relaxed text-gray-500">{t.mentionReception}</p>

      <p className="mt-10 border-t border-gray-100 pt-4 text-center text-xs text-gray-500 print:hidden">
        {t.propulsePar} <a href={`${SITE_URL}/?utm_source=reception&utm_medium=footer`} className="font-medium text-brand underline underline-offset-2">Thermogestion</a>
      </p>
    </main>
  );
}
