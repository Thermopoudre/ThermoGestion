"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SignaturePad from "@/components/SignaturePad";
import SelecteurLangue from "@/components/SelecteurLangue";
import BlocTotaux from "@/components/BlocTotaux";
import { Button, Card, Input } from "@/components/ui";
import { eur, nombreFr } from "@/lib/utils";
import { dateL, euroL, nombreL, qteL, textes, type Langue } from "@/lib/i18n";
import { bloqueParLaValidite, echeanceDevis } from "@/lib/devis";
import { ipPublique } from "@/lib/ip";
import { track } from "@/lib/track";
import { SITE_URL } from "@/lib/env";
import { lignesFacturables, lignesOptionnelles, montantAcompte } from "@/lib/calculs";
import { round2 } from "@/lib/utils";
import type { DevisItem } from "@/lib/types";

type PublicDevis = {
  numero: string | null;
  status: string;
  items: DevisItem[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  remise: { type: "pct" | "montant"; valeur: number } | null;
  notes: string | null;
  created_at: string;
  /** Date d'envoi au client. C'est elle qui fait courir la validité, pas la date de saisie. */
  envoye_at: string | null;
  validite_jours: number;
  /** Échéance calculée par la base (`public.devis_echeance`). C'est elle qui fait foi. */
  expire_le: string | null;
  signed_at: string | null;
  // C1 — acompte à la commande, déjà chiffré côté base (devis_public).
  acompte_pct: number | null;
  montant_acompte: number | null;
  // C6 — connu seulement après signature (posé par signer_devis).
  signature_hors_etablissement: boolean;
  // Conditions générales de vente (migration 76) : déjà figées par la base pour tout devis rendu
  // ici (`devis_public` refuse les brouillons), donc toujours le texte réellement engagé. `null`
  // si l'atelier n'en a renseigné aucune.
  cgv: string | null;
  client: { nom: string; type?: "particulier" | "pro" };
  atelier: {
    nom: string; logo_url: string | null; couleur: string | null; telephone: string | null; email: string | null;
    adresse: string | null; code_postal: string | null; ville: string | null;
    siren: string | null; siret: string | null; tva_intra: string | null;
    forme_juridique: string | null; capital_social: number | null;
    rcs_ville: string | null; rm_numero: string | null;
    assujetti_tva: boolean;
    delai_paiement_jours: number; penalites_taux: number;
    assurance_nom: string | null; assurance_contrat: string | null; assurance_zone: string | null;
    mediateur_nom: string | null; mediateur_adresse: string | null;
  };
};

export default function DevisPublicClient({ devis, token }: { devis: PublicDevis; token: string }) {
  const [nom, setNom] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [done, setDone] = useState(devis.status === "signe");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [langue, setLangue] = useState<Langue>("fr");
  const t = textes(langue);

  // C5 — options proposées mais pas encore décidées : le client les coche avant de signer, son
  // choix est figé par `signer_devis`. Toutes cochées par défaut : décocher est le geste volontaire
  // qui écarte une option, pas l'inverse (une option ignorée ne doit jamais devenir un manque à
  // gagner silencieux pour l'atelier).
  const optionsDisponibles = lignesOptionnelles(devis.items);
  const [optionsChoisies, setOptionsChoisies] = useState<Set<string>>(
    () => new Set(optionsDisponibles.map((it) => it.option_id).filter((id): id is string => !!id)),
  );
  // C6 — le client déclare lui-même si la signature a lieu hors établissement (domicile, salon,
  // foire) : c'est ce geste, pas le canal de consultation, qui fait courir la rétractation.
  const [horsEtablissement, setHorsEtablissement] = useState(false);
  const estParticulier = devis.client.type === "particulier";

  const totalOptionsChoisies = round2(
    optionsDisponibles
      .filter((it) => it.option_id && optionsChoisies.has(it.option_id))
      .reduce((s, it) => s + (Number(it.total_ht) || 0), 0),
  );

  /**
   * L'échéance affichée vient de la base (`expire_le`), le verdict « périmé » est recalculé ici
   * par le miroir de `public.devis_perime`.
   *
   * POURQUOI recalculer plutôt que de comparer `status === "expire"` : le cron `expirer-devis`
   * ne passe qu'une fois par jour, à 6 h 50. Entre le franchissement de l'échéance et son
   * passage, le devis porte encore le statut « envoyé » — mais `signer_devis` refuse déjà. Sans
   * ce calcul, la page proposerait un bouton « Signer » que la base rejetterait, ce qui est la
   * pire des deux erreurs possibles.
   */
  const echeance = devis.expire_le ?? echeanceDevis(devis);
  const perime = bloqueParLaValidite(devis);

  /**
   * D2 — le message d'échec ne doit plus mentir. `signer_devis` renvoie `false` sans distinguer
   * la cause (déjà signé, jeton mort…) : on refait la lecture publique pour savoir CE qui s'est
   * réellement passé plutôt que d'annoncer un échec générique. Trois cas identifiés (expiré,
   * démonstration, déjà signé) ont chacun leur message ; tout le reste retombe sur un message
   * technique honnête, avec un recours immédiat — le téléphone de l'atelier.
   */
  async function signer() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const ip = await ipPublique();
    const { data, error: err } = await supabase.rpc("signer_devis", {
      p_token: token,
      p_nom: nom,
      p_signature: { image: signature, at: new Date().toISOString(), ua: navigator.userAgent, ip },
      p_ip: ip,
      p_options_acceptees: [...optionsChoisies],
      p_hors_etablissement: horsEtablissement,
    });
    if (data === true) {
      setBusy(false);
      track("devis_signed");
      setDone(true);
      return;
    }
    if (err && /DEVIS_EXPIRE/i.test(err.message ?? "")) {
      setBusy(false);
      setError(t.erreurDevisExpire);
      return;
    }
    if (err && /DEMO_LECTURE_SEULE/i.test(err.message ?? "")) {
      setBusy(false);
      setError(t.erreurDemo);
      return;
    }
    // `data === false` sans exception : le devis existe mais n'était plus signable au moment de
    // l'appel. Le cas le plus courant est une signature déjà passée (double clic, deux onglets) —
    // ce n'est pas un échec, on le dit pour ce que c'est plutôt que de laisser le client
    // recommencer un formulaire qui ne servira à rien.
    const { data: relu } = await supabase.rpc("devis_public", { p_token: token });
    setBusy(false);
    if (relu?.status === "signe") {
      setDone(true);
      return;
    }
    setError(t.erreurSignatureDevis(devis.atelier.telephone));
  }

  const accent = devis.atelier.couleur || "#147085";
  const a = devis.atelier;
  // Le capital est formaté en français : cette ligne cite un texte français, la locale d'affichage
  // n'a pas à la réécrire en « 10.000,00 € ».
  const identite = [
    a.forme_juridique,
    a.capital_social ? `au capital de ${eur(a.capital_social)}` : null,
    a.siren ? `SIREN ${a.siren}` : null,
    a.rcs_ville ? `RCS ${a.rcs_ville}` : null,
    a.rm_numero ? `RM ${a.rm_numero}` : null,
    a.tva_intra ? `TVA ${a.tva_intra}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-2xl p-4 print:p-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {devis.atelier.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={devis.atelier.logo_url} alt="" className="h-12 w-12 flex-none rounded object-contain" />
          )}
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-900">{devis.atelier.nom}</div>
            {devis.atelier.adresse && (
              <div className="text-xs text-gray-600">{devis.atelier.adresse}, {devis.atelier.code_postal} {devis.atelier.ville}</div>
            )}
            <div className="text-xs text-gray-500">{[devis.atelier.telephone, devis.atelier.email].filter(Boolean).join(" · ")}</div>
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

      <h1 className="text-xl font-bold" style={{ color: accent }}>{t.devis} {devis.numero}</h1>
      {/* La date d'émission affichée est `envoye_at` : `created_at` était la date de saisie du
          brouillon, donc une date antérieure à celle à partir de laquelle court la validité — le
          document annonçait un délai qui ne collait pas à sa propre échéance. */}
      <p className="mb-4 text-sm text-gray-500">
        {t.pour} {devis.client.nom} · {t.emisLe} {dateL(devis.envoye_at ?? devis.created_at, langue)} ·{" "}
        {t.valableJusquau(dateL(`${echeance}T12:00:00`, langue))}
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
            {lignesFacturables(devis.items).map((it, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">
                  {it.libelle}{it.type === "m2" && it.meta ? ` (${nombreL(it.meta.surface as number, langue)} m², ${it.meta.finition})` : ""}
                  {it.optionnel && <span className="ml-1 text-xs font-medium text-brand">(option retenue)</span>}
                </td>
                <td className="py-2 text-right">{qteL(it.qte, it.unite, langue)}</td>
                <td className="py-2 text-right">{euroL(it.pu_ht, langue)}</td>
                <td className="py-2 text-right">{euroL(it.total_ht, langue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* C5 — options proposées, non comptées dans le total tant qu'elles ne sont pas cochées.
          Elles ne sont modifiables que sur un devis pas encore signé : un devis signé les affiche
          en lecture seule, son choix a déjà été figé par la base. */}
      {optionsDisponibles.length > 0 && (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand-light/40 p-3">
          <div className="mb-2 text-sm font-semibold text-gray-800">Options proposées</div>
          <ul className="flex flex-col gap-2 text-sm">
            {optionsDisponibles.map((it, i) => {
              const id = it.option_id ?? String(i);
              const cochee = optionsChoisies.has(id);
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <label className="flex min-h-[28px] flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 flex-none"
                      checked={cochee}
                      disabled={devis.status !== "envoye"}
                      onChange={() => setOptionsChoisies((s) => {
                        const next = new Set(s);
                        if (next.has(id)) next.delete(id); else next.add(id);
                        return next;
                      })}
                    />
                    <span>{it.libelle}</span>
                  </label>
                  <span className="text-gray-600">{euroL(it.total_ht, langue)}</span>
                </li>
              );
            })}
          </ul>
          {totalOptionsChoisies > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              Options retenues : + {euroL(totalOptionsChoisies, langue)}, à ajouter au total ci-dessous.
            </p>
          )}
        </div>
      )}

      <BlocTotaux
        lignes={lignesFacturables(devis.items)}
        remise={devis.remise}
        totalHt={devis.total_ht}
        totalTva={devis.total_tva}
        totalTtc={devis.total_ttc}
        langue={langue}
      />

      {/* C1 — acompte à la commande, chiffré sur le total réellement dû (options comprises si le
          client les a déjà retenues avant de signer — ce montant est indicatif, celui qui compte
          est recalculé par la base à la signature). */}
      {devis.acompte_pct != null && devis.acompte_pct > 0 && (
        <p className="-mt-4 mb-6 text-sm text-gray-700">
          Acompte à la commande : <b>{nombreL(devis.acompte_pct, langue)} %</b>, soit{" "}
          <b>{euroL(devis.montant_acompte ?? montantAcompte(devis.total_ttc, devis.acompte_pct), langue)}</b> demandés à la signature.
        </p>
      )}

      {devis.notes && <p className="mb-6 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-600">{devis.notes}</p>}

      {/* Mentions de l'émetteur — art. R.123-237 du code de commerce. Elles figuraient sur le PDF
          du devis mais pas sur sa page web : le même document disait deux choses différentes.
          Comme sur la facture, elles restent en français : ce sont des citations de textes français. */}
      <div className="mb-6 space-y-1 border-t border-gray-100 pt-4 text-[11px] leading-relaxed text-gray-500">
        {identite && <p>{identite}</p>}
        {!devis.atelier.assujetti_tva && <p>TVA non applicable, article 293 B du CGI.</p>}
        {/* D6 — bloc de mentions légales : toujours en français (citations de textes français, cf.
            l'en-tête de i18n.ts), y compris le format des nombres. `10.5 %` sur un document
            public sortait du même moule que « 6.8 kg » ailleurs dans l'application. */}
        <p>
          Devis valable {nombreFr(devis.validite_jours)} jours à compter de son émission, soit jusqu&apos;au{" "}
          {dateL(`${echeance}T12:00:00`, "fr")} inclus. Paiement à{" "}
          {nombreFr(devis.atelier.delai_paiement_jours)} jours ; en cas de retard, pénalités au taux annuel de{" "}
          {nombreFr(devis.atelier.penalites_taux)} % et indemnité forfaitaire pour frais de recouvrement de 40 €.
        </p>
        {devis.atelier.assurance_nom && (
          <p>
            Assurance professionnelle : {devis.atelier.assurance_nom}
            {devis.atelier.assurance_contrat ? ` — contrat ${devis.atelier.assurance_contrat}` : ""}
            {devis.atelier.assurance_zone ? ` — couverture : ${devis.atelier.assurance_zone}` : ""}.
          </p>
        )}
        {/* C6 — mention obligatoire du médiateur pour un client particulier. */}
        {estParticulier && (
          devis.atelier.mediateur_nom ? (
            <p>
              Médiateur de la consommation : {devis.atelier.mediateur_nom}
              {devis.atelier.mediateur_adresse ? ` — ${devis.atelier.mediateur_adresse}` : ""}.
            </p>
          ) : (
            <p>Médiateur de la consommation : non renseigné par l&apos;atelier.</p>
          )
        )}
        {/* Défaut n°3 (recette vague 3) — avant signature, rien ne rappelait le droit de
            rétractation à un client particulier : seule la carte de confirmation, plus bas,
            portait la mention, et seulement si la case « hors établissement » avait été cochée à
            la signature (`signature_hors_etablissement`). Un client qui lit cette page avant de
            signer — ou qui ne coche pas la case sans en comprendre la portée — ne voyait jamais
            l'information. Formulation au conditionnel : cette page ne sait pas, avant la
            signature, où elle aura lieu. */}
        {estParticulier && (
          <p>
            Si ce devis a été signé hors de l&apos;établissement, vous disposez d&apos;un délai de
            rétractation de 14 jours (art. L221-18 du Code de la consommation).
          </p>
        )}
      </div>

      {/* Conditions générales de vente (migration 76) — repliées mais accessibles, et affichées
          AVANT la carte de signature ci-dessous : des conditions qu'on n'a pas pu lire avant de
          signer ne sont pas opposables. */}
      {devis.cgv && (
        <details className="mb-6 rounded-lg border border-gray-200 text-sm text-gray-600">
          <summary className="cursor-pointer select-none px-3 py-2.5 font-medium text-gray-800">
            Conditions générales de vente
          </summary>
          <p className="whitespace-pre-wrap border-t border-gray-100 px-3 py-3 text-xs leading-relaxed">
            {devis.cgv}
          </p>
        </details>
      )}

      <div className="print:hidden">
        {done ? (
          <Card className="border-green-300 bg-green-50 text-center">
            <CheckCircle2 size={28} aria-hidden className="mx-auto text-green-600" />
            <div className="font-semibold text-green-800">
              {devis.signed_at ? t.devisAccepteLe(dateL(devis.signed_at, langue)) : t.devisAccepte}
            </div>
            <p className="text-sm text-green-700">{t.devisAccepteAide}</p>
            {estParticulier && devis.signature_hors_etablissement && (
              <p className="mt-2 text-xs text-green-800">
                Signature hors établissement : vous disposez de 14 jours à compter de ce jour pour
                vous rétracter sans justification (art. L221-18 du code de la consommation).
                Contactez l&apos;atelier pour exercer ce droit.
              </p>
            )}
          </Card>
        ) : perime ? (
          /* Le devis a dépassé sa validité. `signer_devis` refuserait de toute façon — la page
             le dit avant, avec la date et la marche à suivre, plutôt que de laisser le client
             signer dans le vide puis lire un message d'échec. */
          <Card className="border-amber-300 bg-amber-50 text-center">
            <div className="font-semibold text-amber-900">{t.devisPerimeTitre}</div>
            <p className="mt-1 text-sm text-amber-800">
              {t.devisPerimeAide(dateL(`${echeance}T12:00:00`, langue))}
            </p>
            {devis.atelier.telephone || devis.atelier.email ? (
              <p className="mt-2 text-sm text-amber-800">
                {[devis.atelier.telephone, devis.atelier.email].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </Card>
        ) : devis.status === "envoye" ? (
          <Card className="flex flex-col gap-3">
            <div>
              <div className="font-semibold text-gray-900">{t.bonPourAccord}</div>
              <p className="text-xs text-gray-500">{t.bonPourAccordAide}</p>
            </div>
            <Input label={t.votreNom} value={nom} onChange={(e) => setNom(e.target.value)} />
            {/* C6 — c'est le client qui déclare le lieu de signature : la base ne peut pas le
                déduire, et c'est ce geste (pas le canal web) qui fait courir la rétractation. */}
            {estParticulier && (
              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 flex-none"
                  checked={horsEtablissement}
                  onChange={(e) => setHorsEtablissement(e.target.checked)}
                />
                <span>
                  Je signe hors de l&apos;établissement de l&apos;atelier (à domicile, sur un salon, une
                  foire...). Cette case ouvre un délai de rétractation de 14 jours.
                </span>
              </label>
            )}
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-600">{t.signature}</span>
              <SignaturePad onChange={setSignature} invite={t.signatureInvite} effacer={t.signatureEffacer} />
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button
              onClick={signer}
              disabled={busy || !nom || !signature}
              className={`min-h-[44px] py-3.5 text-base ${!nom || !signature ? "!bg-gray-200 !text-gray-500" : ""}`}
              style={!nom || !signature ? undefined : { backgroundColor: accent }}
            >
              {busy ? t.envoi : t.signer}
            </Button>
            {(!nom || !signature) && (
              <p className="text-center text-xs text-gray-500">{t.signerAide}</p>
            )}
            <p className="text-[11px] text-gray-500">{t.signerMention(euroL(devis.total_ttc, langue))}</p>
          </Card>
        ) : (
          <p className="text-center text-sm text-gray-500">{t.devisNonSignable(t.statutsDevis[devis.status] ?? devis.status)}</p>
        )}
      </div>
      <p className="mt-10 border-t border-gray-100 pt-4 text-center text-xs text-gray-500 print:hidden">
        {t.propulsePar} <a href={`${SITE_URL}/?utm_source=devis&utm_medium=footer`} className="font-medium text-brand underline underline-offset-2">Thermogestion</a>
      </p>
    </main>
  );
}
