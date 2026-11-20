"use client";
import { useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { Button, Card } from "@/components/ui";
import SelecteurLangue from "@/components/SelecteurLangue";
import BlocTotaux from "@/components/BlocTotaux";
import { eur, factureARegler, nombreFr } from "@/lib/utils";
import { dateL, euroL, qteL, textes, type Langue } from "@/lib/i18n";
import { track } from "@/lib/track";
import { SITE_URL } from "@/lib/env";
import type { DevisItem } from "@/lib/types";

type PublicFacture = {
  numero: string | null;
  type: string;
  status: string;
  items: DevisItem[];
  remise: { type: "pct" | "montant"; valeur: number } | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  due_date: string | null;
  emise_at: string | null;
  stripe_payment_link: string | null;
  nature_operation: "biens" | "services" | "mixte";
  // Conditions générales de vente (migration 76) : déjà figées par la base pour toute facture
  // rendue ici (`facture_public` refuse les brouillons). `null` si l'atelier n'en a renseigné aucune.
  cgv: string | null;
  client: {
    nom: string; siren: string | null;
    adresse: string | null; code_postal: string | null; ville: string | null;
    adresse_livraison: string | null;
    // Le délai négocié avec ce client prime sur celui de l'atelier : c'est lui qui a servi à
    // calculer l'échéance, la mention légale doit dire la même chose.
    delai_paiement_jours: number | null;
  };
  atelier: {
    nom: string; logo_url: string | null; couleur: string | null; telephone: string | null; email: string | null;
    iban: string | null; bic: string | null; stripe_ready: boolean;
    adresse: string | null; code_postal: string | null; ville: string | null;
    siren: string | null; siret: string | null; tva_intra: string | null;
    forme_juridique: string | null; capital_social: number | null;
    rcs_ville: string | null; rm_numero: string | null;
    assujetti_tva: boolean; tva_sur_debits: boolean;
    delai_paiement_jours: number; penalites_taux: number; escompte_texte: string | null;
    assurance_nom: string | null; assurance_contrat: string | null; assurance_zone: string | null;
  };
};

export default function FacturePublicClient({ facture }: { facture: PublicFacture }) {
  const [langue, setLangue] = useState<Langue>("fr");
  const t = textes(langue);
  const a = facture.atelier;
  const accent = a.couleur || "#147085";
  const payee = facture.status === "payee";
  const annulee = facture.status === "annulee";
  const avoir = facture.type === "avoir";
  // Un avoir titré « Facture » et une facture annulée qui propose encore un bouton de paiement,
  // c'est un appel du client au mieux, un paiement indu au pire.
  const titre = t.typesFacture[facture.type] ?? t.facture;
  const aRegler = factureARegler(facture);

  // Identité de l'émetteur : forme juridique, capital, immatriculation — mentions obligatoires
  // dès lors que l'atelier est une société (art. R.123-237 code de commerce).
  // Le capital est formaté en français, pas dans la langue d'affichage : cette ligne est une mention
  // légale française (art. R.123-237), et « au capital de 10.000,00 € » n'a pas de sens en français.
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

      <h1 className="text-xl font-bold" style={{ color: accent }}>
        {titre} {facture.numero}
        {annulee && <span className="ml-2 align-middle text-sm font-semibold uppercase tracking-wide text-red-600">{" "}— {t.factureAnnulee}</span>}
      </h1>
      <p className="mb-1 text-sm text-gray-500">
        {facture.emise_at ? `${t.factureALe} ${dateL(facture.emise_at, langue)}` : t.nonEmise}
        {/* Une échéance sur un avoir ou sur un document annulé annonce un règlement qui n'a pas lieu d'être. */}
        {aRegler && facture.due_date ? ` · ${t.echeance} ${dateL(facture.due_date, langue)}` : ""}
        {` · ${t.natures[facture.nature_operation] ?? ""}`}
      </p>

      <div className="mb-4 rounded bg-gray-50 p-3 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">{t.factureA}</div>
        <div className="font-medium">{facture.client.nom}</div>
        {facture.client.adresse && (
          <div className="text-gray-600">{facture.client.adresse}, {facture.client.code_postal} {facture.client.ville}</div>
        )}
        {facture.client.siren && <div className="text-gray-600">SIREN {facture.client.siren}</div>}
        {facture.client.adresse_livraison && (
          <div className="mt-1 text-gray-600">
            <span className="text-xs uppercase tracking-wide text-gray-500">{t.livraison} — </span>
            {facture.client.adresse_livraison}
          </div>
        )}
      </div>

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
            {facture.items.map((it, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">{it.libelle}</td>
                <td className="py-2 text-right">{qteL(it.qte, it.unite, langue)}</td>
                <td className="py-2 text-right">{euroL(it.pu_ht, langue)}</td>
                <td className="py-2 text-right">{euroL(it.total_ht, langue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BlocTotaux
        lignes={facture.items}
        remise={facture.remise}
        totalHt={facture.total_ht}
        totalTva={facture.total_tva}
        totalTtc={facture.total_ttc}
        langue={langue}
      />

      {/* Les mentions ci-dessous citent des textes français : les traduire leur ferait perdre
          leur valeur juridique. Elles restent en français quelle que soit la langue d'affichage. */}
      {!a.assujetti_tva && (
        <p className="mb-4 text-xs text-gray-600">TVA non applicable, article 293 B du CGI.</p>
      )}
      {a.tva_sur_debits && (
        <p className="mb-4 text-xs text-gray-600">Option pour le paiement de la TVA d&apos;après les débits.</p>
      )}

      {/* Coordonnées bancaires seulement s'il y a quelque chose à régler : les afficher sur un avoir
          ou sur un document annulé, c'est inviter le client à payer ce qu'il ne doit pas. */}
      {aRegler && a.iban && (
        <p className="mb-4 rounded bg-gray-50 p-3 text-xs text-gray-600">
          {t.virement} : IBAN {a.iban}{a.bic ? ` · BIC ${a.bic}` : ""}
        </p>
      )}

      {/* Mentions obligatoires — art. L441-9 code de commerce et art. 242 nonies A annexe II CGI. */}
      <div className="mb-6 space-y-1 border-t border-gray-100 pt-4 text-[11px] leading-relaxed text-gray-500">
        {identite && <p>{identite}</p>}
        {/* Un avoir n'appelle pas de règlement et une facture annulée non plus : afficher un délai
            de paiement et des pénalités de retard sur ces documents serait faux. */}
        {aRegler && (
          <>
            {/* D6 — mentions légales : toujours en français, nombres compris (« 10.5 % » sortait
                du même moule que les autres nombres bruts de l'application). */}
            <p>
              Paiement à {nombreFr(facture.client.delai_paiement_jours ?? a.delai_paiement_jours)} jours à compter de la date d&apos;émission.
              {" "}En cas de retard, pénalités au taux annuel de {nombreFr(a.penalites_taux)} % et indemnité forfaitaire
              pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du code de commerce).
            </p>
            <p>{a.escompte_texte || "Pas d'escompte pour paiement anticipé."}</p>
          </>
        )}
        {a.assurance_nom && (
          <p>
            Assurance professionnelle : {a.assurance_nom}
            {a.assurance_contrat ? ` — contrat ${a.assurance_contrat}` : ""}
            {a.assurance_zone ? ` — couverture : ${a.assurance_zone}` : ""}.
          </p>
        )}
      </div>

      {/* Conditions générales de vente (migration 76) — repliées mais accessibles. */}
      {facture.cgv && (
        <details className="mb-6 rounded-lg border border-gray-200 text-sm text-gray-600">
          <summary className="cursor-pointer select-none px-3 py-2.5 font-medium text-gray-800">
            Conditions générales de vente
          </summary>
          <p className="whitespace-pre-wrap border-t border-gray-100 px-3 py-3 text-xs leading-relaxed">
            {facture.cgv}
          </p>
        </details>
      )}

      <div className="print:hidden">
        {annulee ? (
          <Card className="border-red-300 bg-red-50 text-center">
            <div className="font-semibold text-red-800">{t.factureAnnulee}</div>
            <p className="text-sm text-red-700">{t.factureAnnuleeAide}</p>
          </Card>
        ) : avoir ? (
          <Card className="border-gray-300 bg-gray-50 text-center">
            <p className="text-sm text-gray-700">{t.avoirMention}</p>
          </Card>
        ) : payee ? (
          <Card className="border-green-300 bg-green-50 text-center">
            <CheckCircle2 size={28} aria-hidden className="mx-auto text-green-600" />
            <div className="font-semibold text-green-800">{t.factureReglee}</div>
            <p className="text-sm text-green-700">{t.merci}</p>
          </Card>
        ) : !aRegler ? (
          <p className="text-center text-sm text-gray-500">{t.rienARegler}</p>
        ) : facture.stripe_payment_link ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 py-3.5 text-base"
              style={{ backgroundColor: accent }}
              onClick={() => { track("facture_pay_click"); window.location.href = facture.stripe_payment_link!; }}
            >
              <Lock size={16} aria-hidden />
              {t.payer(euroL(facture.total_ttc, langue))}
            </Button>
            <p className="text-xs text-gray-500">
              {t.paiementSecurise}{a.iban ? t.paiementVirement : ""}.
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500">{t.paiementIndispo}</p>
        )}
      </div>
      <p className="mt-10 border-t border-gray-100 pt-4 text-center text-xs text-gray-500 print:hidden">
        {t.propulsePar} <a href={`${SITE_URL}/?utm_source=facture&utm_medium=footer`} className="font-medium text-brand underline underline-offset-2">Thermogestion</a>
      </p>
    </main>
  );
}
