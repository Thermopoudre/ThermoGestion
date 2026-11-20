"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SignaturePad from "@/components/SignaturePad";
import { Button, Card, Input } from "@/components/ui";
import { dateFr, nombreFr } from "@/lib/utils";
import { ipPublique } from "@/lib/ip";
import { SITE_URL } from "@/lib/env";
import { ETATS_JANTE, OPERATIONS_JANTE, POSITIONS_JANTE, libelleJeu } from "@/lib/jantes";

export type PublicJeuJantes = {
  numero: string | null;
  nb_jantes: number;
  diametre_pouces: number | string;
  largeur_pouces: number | string | null;
  dessin: string;
  finition: string;
  teinte: string | null;
  pneus_montes: boolean;
  tpms: boolean;
  statut: string;
  date_promise: string | null;
  reserves: string | null;
  depose_par: string | null;
  note: string | null;
  created_at: string;
  signature: { image?: string } | null;
  signed_at: string | null;
  vehicule: { marque: string; modele: string | null; annee: number | null; immatriculation: string | null; teinte_origine: string | null; teinte_reference: string | null } | null;
  jantes: { position: string; etat_constate: string[]; voile_mm: number | string | null; operations: string[]; statut: string; reserves: string | null; photos: string[] }[];
  photos: string[];
  client: { nom: string };
  atelier: { nom: string; logo_url: string | null; couleur: string | null; telephone: string | null; email: string | null };
};

/**
 * Le bon de prise en charge que voit le garage, jante par jante.
 *
 * Il n'existe que pour une raison : rendre incontestable l'état des jantes au moment du dépôt.
 * D'où la structure — une jante, ses défauts, ses photos — et la signature, qui doit être
 * recueillie **avant** le démontage des pneus.
 */
export default function JeuJantesPublicClient({
  jeu,
  token,
  urls,
  photosIndisponibles,
}: {
  jeu: PublicJeuJantes;
  token: string;
  urls: Record<string, string>;
  photosIndisponibles: boolean;
}) {
  const [nom, setNom] = useState(jeu.depose_par ?? "");
  const [signature, setSignature] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState(jeu.signed_at);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  const a = jeu.atelier;
  const accent = a.couleur || "#147085";
  const teinteOrigine = !!jeu.teinte && jeu.teinte === jeu.vehicule?.teinte_origine;

  async function signer() {
    setBusy(true);
    setErreur("");
    const supabase = createClient();
    const ip = await ipPublique();
    const { data, error } = await supabase.rpc("signer_jeu_jantes", {
      p_token: token,
      p_nom: nom,
      p_signature: { image: signature, at: new Date().toISOString(), ua: navigator.userAgent, ip },
      p_ip: ip,
    });
    setBusy(false);
    const res = data as { ok?: boolean; motif?: string } | null;
    if (error || !res?.ok) {
      setErreur(
        // L'atelier de démonstration refuse toute écriture en base : sans ce cas, un prospect
        // qui essaie de signer lit « la signature n'a pas pu être enregistrée » et croit à un bug.
        error?.message?.includes("DEMO_LECTURE_SEULE")
          ? "Vous consultez la démonstration : rien n'y est enregistré."
          : res?.motif === "deja_signe" ? "Ce bon a déjà été signé."
          : res?.motif === "nom_requis" ? "Indiquez votre nom avant de signer."
          // D2 — dernier recours honnête : on dit qu'on ne sait pas, on dit quoi faire.
          : `La signature n'a pas pu être enregistrée. Réessayez${a.telephone ? ` ; si ça persiste, appelez l'atelier au ${a.telephone}.` : ", et contactez l'atelier si ça persiste."}`,
      );
      return;
    }
    setSignedAt(new Date().toISOString());
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
            <div className="text-xs text-gray-500">{[a.telephone, a.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="min-h-[44px] shrink-0 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 print:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Imprimer
        </button>
      </div>

      <h1 className="text-xl font-bold" style={{ color: accent }}>
        Prise en charge {jeu.numero}
      </h1>
      <p className="mb-4 text-sm text-gray-500">Déposé le {dateFr(jeu.created_at)}</p>

      <Card className="mb-4 flex flex-col gap-1">
        <div className="text-sm font-semibold">
          {libelleJeu({
            nbJantes: jeu.nb_jantes,
            diametre: Number(jeu.diametre_pouces),
            finition: jeu.finition,
            teinte: jeu.teinte,
            teinteReference: teinteOrigine ? jeu.vehicule?.teinte_reference : null,
            teinteOrigine,
            vehicule: jeu.vehicule,
          })}
        </div>
        <div className="text-xs text-gray-500">
          {jeu.client.nom}
          {jeu.vehicule?.immatriculation ? ` · ${jeu.vehicule.immatriculation}` : ""}
          {jeu.largeur_pouces != null ? ` · ${nombreFr(jeu.largeur_pouces, 1)}J` : ""}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          {jeu.pneus_montes && <span className="rounded bg-gray-100 px-2 py-0.5">Pneus montés</span>}
          {jeu.tpms && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">Capteurs TPMS</span>}
          {jeu.date_promise && <span className="rounded bg-gray-100 px-2 py-0.5">À rendre le {dateFr(jeu.date_promise)}</span>}
        </div>
      </Card>

      {jeu.reserves && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Réserves</div>
          <p className="whitespace-pre-wrap text-sm text-amber-900">{jeu.reserves}</p>
        </div>
      )}

      {photosIndisponibles && (
        <p className="mb-4 rounded bg-gray-50 p-2 text-xs text-gray-600">
          Les photos ne sont pas affichables sur ce lien pour le moment. Demandez-les à l&apos;atelier.
        </p>
      )}

      <div className="mb-6 flex flex-col gap-3">
        {jeu.jantes.map((r) => {
          const position = POSITIONS_JANTE.find((p) => p.code === r.position);
          return (
            <div key={r.position} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                  {position?.court ?? r.position}
                </span>
                <span className="text-sm font-medium">{position?.libelle ?? r.position}</span>
              </div>
              <div className="text-sm text-gray-700">
                {r.etat_constate?.length
                  ? r.etat_constate.map((e) => ETATS_JANTE[e] ?? e).join(", ")
                  : "Aucun défaut relevé"}
                {r.voile_mm != null && ` · voile ${nombreFr(r.voile_mm, 1)} mm`}
              </div>
              {r.operations?.length > 0 && (
                <div className="mt-0.5 text-xs text-gray-500">
                  À réaliser : {r.operations.map((o) => OPERATIONS_JANTE[o as keyof typeof OPERATIONS_JANTE] ?? o).join(", ")}
                </div>
              )}
              {r.reserves && <div className="mt-0.5 text-xs text-amber-800">{r.reserves}</div>}
              {r.photos?.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {r.photos.map((p) =>
                    urls[p] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p} src={urls[p]} alt="" className="aspect-square rounded-lg object-cover" />
                    ) : null,
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {signedAt ? (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Bon signé{jeu.depose_par ? ` par ${jeu.depose_par}` : ""} le {dateFr(signedAt)}.
          {jeu.signature?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={jeu.signature.image} alt="Signature" className="mt-2 h-20 w-full max-w-xs rounded border border-green-200 bg-white object-contain" />
          )}
        </div>
      ) : (
        <Card className="mb-6 flex flex-col gap-3 print:hidden">
          <div className="text-sm font-semibold">Validez l&apos;état constaté</div>
          <p className="-mt-2 text-xs text-gray-500">
            En signant, vous confirmez l&apos;état de chaque jante à la remise. Cette validation
            protège les deux parties.
          </p>
          <Input label="Votre nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom et prénom" />
          <SignaturePad onChange={setSignature} />
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <Button disabled={busy || !nom.trim()} onClick={signer}>
            {busy ? "Enregistrement…" : "Signer le bon de prise en charge"}
          </Button>
        </Card>
      )}

      <p className="mb-6 text-[11px] leading-relaxed text-gray-500">
        Ce document constate l&apos;état des jantes au moment de leur dépôt. Les défauts non
        mentionnés ci-dessus sont réputés absents à la prise en charge. Les capteurs de pression
        (TPMS) sont des pièces d&apos;usure fragiles : leur remplacement, s&apos;il s&apos;avère
        nécessaire au remontage, fait l&apos;objet d&apos;un accord préalable.
      </p>

      <p className="mt-10 border-t border-gray-100 pt-4 text-center text-xs text-gray-500 print:hidden">
        Propulsé par{" "}
        <a href={`${SITE_URL}/?utm_source=jantes&utm_medium=footer`} className="font-medium text-brand underline underline-offset-2">
          Thermogestion
        </a>
      </p>
    </main>
  );
}
