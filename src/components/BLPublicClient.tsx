"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SignaturePad from "@/components/SignaturePad";
import SelecteurLangue from "@/components/SelecteurLangue";
import BlocTotaux from "@/components/BlocTotaux";
import { Button, Card, Input } from "@/components/ui";
import { calcTotaux } from "@/lib/utils";
import { dateL, euroL, nombreL, qteL, textes, type Langue } from "@/lib/i18n";
import { ipPublique } from "@/lib/ip";
import { track } from "@/lib/track";
import { SITE_URL } from "@/lib/env";
import type { LigneBL, Remise } from "@/lib/types";

type PublicBL = {
  numero: string | null;
  status: string;
  lignes: LigneBL[];
  remise: Remise;
  nb_colis: number | null;
  poids_kg: number | null;
  note: string | null;
  livre_at: string | null;
  recu_par: string | null;
  signed_at: string | null;
  client: { nom: string };
  atelier: {
    nom: string; logo_url: string | null; couleur: string | null;
    telephone: string | null; email: string | null;
    adresse: string | null; code_postal: string | null; ville: string | null;
  };
};

export default function BLPublicClient({ bl, token }: { bl: PublicBL; token: string }) {
  const [nom, setNom] = useState(bl.recu_par ?? "");
  const [signature, setSignature] = useState<string | null>(null);
  const [done, setDone] = useState(!!bl.signed_at || bl.status === "livre" || bl.status === "facture");
  // `bl.signed_at` vient des props serveur, figées à l'ouverture de la page : sans état local,
  // la confirmation resterait affichée sans date juste après la signature.
  const [signedAt, setSignedAt] = useState(bl.signed_at);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [langue, setLangue] = useState<Langue>("fr");
  const t = textes(langue);

  const a = bl.atelier;
  const accent = a.couleur || "#147085";
  // Le BL ne stocke pas ses totaux : ils se recalculent sur les lignes ET la remise reprise du
  // devis. Sans la remise, le client lisait ici un total supérieur à celui de sa facture.
  const totaux = calcTotaux(bl.lignes ?? [], bl.remise);

  // D2 — `signer_bl` distingue déjà « introuvable » et « déjà signé » (`res.erreur`, en clair).
  // Restait un trou : l'atelier de démonstration lève `DEMO_LECTURE_SEULE` en exception (pas dans
  // `res`), et retombait donc sur le message technique générique — un prospect qui essaie de
  // signer croyait à un bug plutôt qu'à une démonstration en lecture seule.
  async function signer() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const ip = await ipPublique();
    const { data, error: err } = await supabase.rpc("signer_bl", {
      p_token: token,
      p_nom: nom,
      p_signature: { image: signature, at: new Date().toISOString(), ua: navigator.userAgent, ip },
      p_ip: ip,
    });
    setBusy(false);
    const res = data as { ok?: boolean; erreur?: string } | null;
    if (err || !res?.ok) {
      setError(
        /DEMO_LECTURE_SEULE/i.test(err?.message ?? "")
          ? t.erreurDemo
          : (res?.erreur ?? t.erreurSignatureBl(a.telephone)),
      );
      return;
    }
    track("bl_signed");
    setSignedAt(new Date().toISOString());
    setDone(true);
  }

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
            {a.adresse && <div className="text-xs text-gray-600">{a.adresse}, {a.code_postal} {a.ville}</div>}
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

      <h1 className="text-xl font-bold" style={{ color: accent }}>{t.bonLivraison} {bl.numero}</h1>
      <p className="mb-4 text-sm text-gray-500">
        {t.pour} {bl.client.nom}
        {bl.livre_at ? ` · ${t.livreLe} ${dateL(bl.livre_at, langue)}` : ""}
      </p>

      <div className="mb-4 -mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-2">{t.designation}</th>
              <th className="py-2 text-right">{t.qte}</th>
              <th className="py-2 text-right">{t.puHt}</th>
              <th className="py-2 text-right">{t.totalLigneHt}</th>
            </tr>
          </thead>
          <tbody>
            {(bl.lignes ?? []).map((l, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">{l.libelle}</td>
                <td className="py-2 text-right">{qteL(l.qte, l.unite, langue)}</td>
                <td className="py-2 text-right">{euroL(l.pu_ht, langue)}</td>
                <td className="py-2 text-right">{euroL(l.total_ht, langue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BlocTotaux
        lignes={bl.lignes ?? []}
        remise={bl.remise}
        totalHt={totaux.total_ht}
        totalTva={totaux.total_tva}
        totalTtc={totaux.total_ttc}
        langue={langue}
        className="mb-4 ml-auto w-56 text-sm"
      />

      {(bl.nb_colis || bl.poids_kg) && (
        <p className="mb-4 text-sm text-gray-600">
          {bl.nb_colis ? `${bl.nb_colis} ${t.colis}` : ""}{bl.nb_colis && bl.poids_kg ? " · " : ""}
          {bl.poids_kg ? `${nombreL(bl.poids_kg, langue)} kg` : ""}
        </p>
      )}

      {bl.note && <p className="mb-6 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-600">{bl.note}</p>}

      <div className="print:hidden">
        {done ? (
          <Card className="border-green-300 bg-green-50 text-center">
            <CheckCircle2 size={28} aria-hidden className="mx-auto text-green-600" />
            <div className="font-semibold text-green-800">
              {signedAt ? t.receptionConfirmeeLe(dateL(signedAt, langue)) : t.receptionConfirmee}
            </div>
            <p className="text-sm text-green-700">{t.receptionMerci}</p>
          </Card>
        ) : bl.status === "emis" ? (
          <Card className="flex flex-col gap-3">
            <div className="font-semibold">{t.bonPourReception}</div>
            <p className="text-xs text-gray-500">{t.bonPourReceptionAide}</p>
            <Input label={t.votreNom} value={nom} onChange={(e) => setNom(e.target.value)} />
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-600">{t.signature}</span>
              <SignaturePad onChange={setSignature} invite={t.signatureInvite} effacer={t.signatureEffacer} />
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button
              onClick={signer}
              disabled={busy || !nom || !signature}
              taille="xl"
              style={!nom || !signature ? undefined : { backgroundColor: accent }}
            >
              {busy ? t.envoi : t.confirmerReception}
            </Button>
            {(!nom || !signature) && (
              <p className="text-center text-xs text-gray-500">{t.signerAide}</p>
            )}
          </Card>
        ) : (
          <p className="text-center text-sm text-gray-500">{t.blNonSignable}</p>
        )}
      </div>

      <p className="mt-10 border-t border-gray-100 pt-4 text-center text-xs text-gray-500 print:hidden">
        {t.propulsePar} <a href={`${SITE_URL}/?utm_source=bl&utm_medium=footer`} className="font-medium text-brand underline underline-offset-2">Thermogestion</a>
      </p>
    </main>
  );
}
