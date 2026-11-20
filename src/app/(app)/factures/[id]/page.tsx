"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Check, Copy, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import FactureEditor from "@/components/FactureEditor";
import ReglagesRelances from "@/components/ReglagesRelances";
import PartagerLien from "@/components/PartagerLien";
import EnvoyerDocument from "@/components/EnvoyerDocument";
import BoutonCorbeille from "@/components/BoutonCorbeille";
import Historique from "@/components/Historique";
import { useToast } from "@/components/Toast";
import { Badge, Button, Card, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import { useTitreDocument } from "@/lib/titre";
import { STATUS_FACTURE, dateFr, estDeductionAcompte, eur, factureEchue, nombreFr, qteFr, round2 } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import type { Facture, Paiement } from "@/lib/types";

/** Un avoir de la facture, tel que la fiche a besoin de le montrer. */
type AvoirLie = { id: string; numero: string | null; status: string; total_ttc: number | string };

export default function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [facture, setFacture] = useState<Facture | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [avoirs, setAvoirs] = useState<AvoirLie[]>([]);
  const [origine, setOrigine] = useState<{ id: string; numero: string | null } | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [montantManuel, setMontantManuel] = useState("");
  const [moyenManuel, setMoyenManuel] = useState<"virement" | "especes" | "cheque" | "cb">("virement");
  // Panneau d'annulation : le motif est obligatoire, la base le refuse vide.
  const [panneauAnnuler, setPanneauAnnuler] = useState(false);
  const [motif, setMotif] = useState("");
  // Panneau d'avoir : par défaut toutes les lignes (avoir total), sinon la sélection de l'atelier.
  const [panneauAvoir, setPanneauAvoir] = useState(false);
  const [lignesAvoir, setLignesAvoir] = useState<number[]>([]);
  const toast = useToast();

  async function reload() {
    const [{ data: f }, { data: at }, { data: pmts }, { data: avs }] = await Promise.all([
      supabase.from("factures").select("*, clients(nom, email)").eq("id", id).single(),
      supabase.from("ateliers").select("stripe_account_id").maybeSingle(),
      supabase.from("paiements").select("*").eq("facture_id", id).order("paye_at", { ascending: false }),
      supabase.from("factures").select("id, numero, status, total_ttc").eq("facture_liee_id", id).eq("type", "avoir").order("created_at"),
    ]);
    const doc = f as unknown as Facture | null;
    setFacture(doc);
    setStripeReady(!!at?.stripe_account_id);
    setPaiements((pmts as Paiement[]) ?? []);
    setAvoirs((avs as AvoirLie[]) ?? []);
    // Un avoir affiche la facture qu'il corrige : sans ce rappel, le document est illisible seul.
    if (doc?.type === "avoir" && doc.facture_liee_id) {
      const { data: src } = await supabase.from("factures").select("id, numero").eq("id", doc.facture_liee_id).maybeSingle();
      setOrigine((src as { id: string; numero: string | null } | null) ?? null);
    } else setOrigine(null);
    // Pré-remplissage au reste dû, pas au total : sur une facture déjà partiellement encaissée,
    // proposer le total conduit à saisir un second paiement plein et à doubler l'encaissement.
    const deja = ((pmts as Paiement[]) ?? []).reduce((s, p) => s + Number(p.montant || 0), 0);
    // D6 — `String(374.4)` rend « 374.4 » : la virgule française passait pour un point dans un
    // champ pré-rempli. `nombreFr` affiche « 374,4 » ; `enregistrerPaiementManuel` sait relire
    // les deux formats (voir plus bas).
    if (!montantManuel && doc) setMontantManuel(nombreFr(Math.max(0, Math.round((Number(doc.total_ttc) - deja) * 100) / 100)));
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useTitreDocument(facture ? `${facture.type === "avoir" ? "Avoir" : "Facture"} ${facture.numero ?? "brouillon"} — ${facture.clients?.nom ?? ""}` : null);

  if (!facture) return <Spinner />;

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/f/${facture.public_token}` : "";
  const encaisse = round2(paiements.reduce((s, p) => s + Number(p.montant || 0), 0));
  const resteDu = round2(Number(facture.total_ttc) - encaisse);
  const annulee = facture.status === "annulee";
  const estAvoir = facture.type === "avoir";
  // Cumul déjà crédité, brouillons compris : c'est le même compte que fait le trigger `avoir_plafond`.
  const dejaCredite = round2(avoirs.filter((a) => a.status !== "annulee").reduce((s, a) => s + Number(a.total_ttc || 0), 0));
  const creditRestant = round2(Number(facture.total_ttc) - dejaCredite);
  // Une facture payée ne s'annule pas : c'est un avoir qu'il faut. Idem dès le premier règlement
  // partiel, qui laisse le statut « émise ». La règle est appliquée en base ; ici on évite juste
  // de proposer un bouton qui ne peut que refuser.
  const peutAnnuler = facture.status === "emise" && encaisse === 0 && !estAvoir;
  const peutAvoir = ["emise", "payee"].includes(facture.status) && !estAvoir && creditRestant > 0;

  async function emettre() {
    setBusy(true);
    let numero = facture!.numero;
    if (!numero) {
      // Un avoir prend la série AV-, jamais la série des factures : deux documents de sens
      // comptable opposé dans la même séquence, c'est un rejet à l'export FEC.
      const { data, error } = await supabase.rpc("next_numero", { p_type: facture!.type === "avoir" ? "avoir" : "facture" });
      if (error) { toast(errorFr(error), "error"); setBusy(false); return; }
      numero = data as string;
    }
    const ok = await ecrire(
      supabase.from("factures").update({ status: "emise", numero, emise_at: new Date().toISOString() }).eq("id", id),
      toast,
      facture!.type === "avoir" ? "Avoir émis — lien client prêt" : "Facture émise — lien client prêt",
    );
    if (ok && facture!.clients?.email) {
      // L'annonce au client passe par une RPC, plus par un `insert` direct dans `notifications`.
      //
      // POURQUOI. L'insert était refusé par RLS — la table n'a aucune politique INSERT — et il
      // l'a toujours été : sur les seize notifications parties depuis la mise en service, il n'y a
      // **aucun** `facture_emise`. L'atelier croyait son client prévenu de sa facture.
      // Et on n'a pas ouvert la table en écriture pour autant : un compte connecté qui choisit le
      // destinataire, le modèle et le `payload` d'un e-mail parti de notre serveur d'envoi, c'est
      // un relais de messagerie ouvert. La RPC déduit tout de la base.
      //
      // Non bloquant — la facture est émise, c'est l'essentiel — mais son échec ne disparaît pas.
      await ecrire(supabase.rpc("notifier_facture_emise", { p_facture: id }), toast);
    }
    if (ok) await reload();
    setBusy(false);
  }

  /**
   * Duplication, annulation et avoir passent tous par une RPC. POURQUOI : ce sont des règles
   * comptables, pas des préférences d'affichage. Une facture payée qui ne s'annule pas, un cumul
   * d'avoirs qui ne dépasse pas la facture d'origine, un numéro qui reste consommé — un garde-fou
   * qui n'existe que dans React se contourne depuis la console du navigateur.
   */
  async function dupliquer() {
    setBusy(true);
    const { data, error } = await supabase.rpc("dupliquer_facture", { p_id: id });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Copie créée en brouillon — échéance recalculée");
    router.push(`/factures/${data as string}`);
  }

  async function annuler() {
    setBusy(true);
    const { error } = await supabase.rpc("annuler_facture", { p_id: id, p_motif: motif });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setPanneauAnnuler(false);
    setMotif("");
    toast("Facture annulée — son numéro reste consommé");
    await reload();
  }

  async function creerAvoir(total: boolean) {
    setBusy(true);
    const { data, error } = await supabase.rpc("avoir_depuis_facture", {
      p_id: id,
      p_lignes: total ? null : lignesAvoir,
    });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setPanneauAvoir(false);
    toast("Avoir créé en brouillon — vérifiez-le puis émettez-le");
    router.push(`/factures/${data as string}`);
  }

  async function creerLienStripe() {
    setBusy(true);
    const res = await fetch(`/api/factures/${id}/payment-link`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { toast(data.error ?? "Impossible de créer le lien de paiement", "error"); return; }
    toast("Lien de paiement Stripe créé");
    await reload();
  }

  async function enregistrerPaiementManuel() {
    setBusy(true);
    // Le champ peut porter le pré-remplissage français (« 374,4 », espaces fines de milliers) ou
    // la saisie de `ChampDecimal` (déjà en point, voir D6 ci-dessus) : les deux se relisent ici.
    const montant = Number(montantManuel.replace(/\s/g, "").replace(",", "."));
    const { error } = await supabase.from("paiements").insert({
      atelier_id: facture!.atelier_id, facture_id: id, montant, moyen: moyenManuel,
    });
    // Un acompte encaissé ne solde pas la facture. La marquer « payée » sur un versement partiel
    // la sort de la file de relance et du compteur d'impayés : le reste dû n'est plus jamais
    // réclamé. Le passage en « payée » n'a lieu qu'au centime près.
    const dejaEncaisse = paiements.reduce((s, p) => s + Number(p.montant || 0), 0);
    const soldee = round2(dejaEncaisse + montant) >= round2(Number(facture!.total_ttc));
    if (error) { setBusy(false); toast(errorFr(error), "error"); return; }
    // Le passage en « payée » échouait en silence : le paiement était enregistré, la facture
    // restait « émise », et elle repartait en relance chez un client qui a déjà réglé.
    if (soldee && !(await ecrire(supabase.from("factures").update({ status: "payee" }).eq("id", id), toast))) {
      setBusy(false);
      await reload();
      return;
    }
    setBusy(false);
    toast(soldee ? "Paiement enregistré — facture soldée" : `Paiement partiel enregistré — reste dû ${eur(round2(Number(facture!.total_ttc) - dejaEncaisse - montant))}`);
    await reload();
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      {/* D11 — une échéance dépassée ne se distinguait pas d'une échéance tenue sur cette fiche,
          alors que /factures et le portail client la montrent désormais en rouge (voir
          `factureEchue`, lib/utils.ts). */}
      <PageTitle action={<Badge tone={factureEchue(facture) ? "danger" : STATUS_FACTURE[facture.status]?.ton}>{factureEchue(facture) ? "Échue" : STATUS_FACTURE[facture.status]?.label ?? facture.status}</Badge>}>
        {facture.numero ?? "Brouillon"}
      </PageTitle>

      {annulee && (
        <Card className="flex flex-col gap-1 border-danger bg-danger-light text-sm text-danger-dark">
          <div className="font-semibold">Facture annulée{facture.annulee_at ? ` le ${dateFr(facture.annulee_at)}` : ""}</div>
          {facture.motif_annulation && <p>Motif : {facture.motif_annulation}</p>}
          <p className="text-xs">
            Elle reste en base avec son numéro : une numérotation comptable est chronologique et
            continue, un numéro annulé n&apos;est jamais réutilisé. Elle est exclue de l&apos;export FEC et
            ses bons de livraison sont repartis vers la prochaine facture.
          </p>
        </Card>
      )}

      {estAvoir && (
        <Card className="flex flex-col gap-1 border-brand/30 bg-brand-light text-sm text-brand-dark">
          <div className="font-semibold">Avoir</div>
          <p>
            {origine ? (
              <>
                Corrige la facture{" "}
                <Link href={`/factures/${origine.id}`} className="underline underline-offset-2">
                  {origine.numero ?? "d'origine"}
                </Link>.
              </>
            ) : (
              "Ce document vient en déduction, il n'appelle aucun règlement."
            )}
          </p>
          <p className="text-xs">
            Les montants sont écrits au positif : c&apos;est le type du document qui dit qu&apos;il vient en
            déduction. L&apos;export comptable l&apos;écrit en sens inverse de la facture, tout seul.
          </p>
        </Card>
      )}

      {facture.status === "brouillon" && (
        <Button onClick={emettre} loading={busy}>
          {estAvoir ? "Émettre l'avoir et générer le lien client" : "Émettre la facture et générer le lien client"}
        </Button>
      )}

      {facture.status !== "brouillon" && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-medium">Lien client (consultation{!annulee && !estAvoir && facture.status !== "payee" ? " + paiement" : ""})</div>
          <PartagerLien
            url={publicUrl}
            titre={`${estAvoir ? "Avoir" : "Facture"} ${facture.numero ?? ""}`}
            texte={estAvoir ? "Voici votre avoir." : "Voici votre facture."}
          />
          <EnvoyerDocument
            type="facture"
            id={facture.id}
            clientEmail={facture.clients?.email ?? null}
            mailtoHref={`mailto:?subject=${encodeURIComponent(`${estAvoir ? "Avoir" : "Facture"} ${facture.numero ?? ""}`)}&body=${encodeURIComponent(`Bonjour,%0A%0AVoici votre document : ${publicUrl}`)}`.replace(/%250A/g, "%0A")}
          />
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Documents</div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/pdf/facture/${id}`}
            target="_blank" rel="noreferrer"
            className="rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800"
          >
            PDF de la facture
          </a>
          {facture.numero && (
            <a
              href={`/api/pdf/facture/${id}?facturx=1`}
              target="_blank" rel="noreferrer"
              className="rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800"
            >
              Facture électronique (Factur-X)
            </a>
          )}
          {/* C3 — lettre de relance papier : mentions L441-10 (pénalités + indemnité forfaitaire
              de 40 €), reste dû calculé au jour de l'édition. Proposée seulement sur une facture
              réellement échue et impayée, comme le badge « Échue » ci-dessus. */}
          {factureEchue(facture) && (
            <a
              href={`/api/pdf/relance/${id}`}
              target="_blank" rel="noreferrer"
              className="rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800"
            >
              Lettre de relance (PDF)
            </a>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Le fichier Factur-X est le même PDF, augmenté de la facture au format XML : le logiciel
          comptable de votre client la lit sans ressaisie. Sa réception devient obligatoire pour
          toutes les entreprises au 1<sup>er</sup> septembre 2026. Il est produit au profil
          EN&nbsp;16931, le seul admis par la réforme avec EXTENDED-CTC-FR : le XML porte donc le
          détail des lignes, la TVA par taux, le SIREN de votre client et, si elle diffère, son
          adresse de livraison. Si l&apos;un de ces éléments manque, le bouton vous dira lequel.
        </p>
      </Card>

      {/* Migration 76 — ce que cette facture porte comme conditions générales de vente. Figées à
          l'émission (trg_figer_cgv) : elles ne bougent plus ensuite. Absent sur une facture
          reprise (origine = 'reprise') : elle vient de l'ancien logiciel de l'atelier. */}
      {facture.status !== "brouillon" && facture.origine !== "reprise" && (
        <Card className="flex flex-col gap-1 text-sm">
          <div className="font-medium text-gray-800">Conditions générales de vente</div>
          {facture.cgv_texte ? (
            <p className="text-xs text-gray-500">
              Cette facture porte les conditions figées à son émission : elles ne changeront plus,
              quoi que vous modifiiez désormais dans les réglages de l&apos;atelier ou de ce client.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Aucune condition générale de vente n&apos;était renseignée au moment de l&apos;émission de
              cette facture.
            </p>
          )}
        </Card>
      )}

      {facture.status === "emise" && !estAvoir && (
        <Card className="flex flex-col gap-3">
          <div className="text-sm font-semibold">Paiement</div>
          {!stripeReady && (
            <p className="text-xs text-amber-600">
              Paiement en ligne non configuré. Connectez Stripe dans Réglages &gt; Compte pour que vos clients paient directement en ligne.
            </p>
          )}
          {stripeReady && !facture.stripe_payment_link && (
            <Button variant="secondary" onClick={creerLienStripe} loading={busy}>Créer le lien de paiement en ligne</Button>
          )}
          {facture.stripe_payment_link && (
            <p className="flex items-center gap-1.5 text-xs text-success-dark">
              <Check size={14} aria-hidden /> Lien de paiement en ligne actif — le client peut payer par CB depuis la page facture.
            </p>
          )}
          <div className="border-t border-gray-100 pt-3">
            <div className="mb-2 text-xs font-medium text-gray-600">Enregistrer un paiement reçu autrement (virement, espèces, chèque)</div>
            <div className="grid grid-cols-[1fr_120px_auto] gap-2">
              <Select value={moyenManuel} onChange={(e) => setMoyenManuel(e.target.value as typeof moyenManuel)}>
                <option value="virement">Virement</option>
                <option value="especes">Espèces</option>
                <option value="cheque">Chèque</option>
                <option value="cb">CB (terminal)</option>
              </Select>
              <Input type="number" step="0.01" value={montantManuel} onChange={(e) => setMontantManuel(e.target.value)} />
              <Button onClick={enregistrerPaiementManuel} loading={busy} disabled={!montantManuel}>Encaisser</Button>
            </div>
          </div>
        </Card>
      )}

      {paiements.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Paiements reçus</div>
          {paiements.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-gray-50 py-1.5 text-sm last:border-0">
              <span className="text-gray-600">{p.moyen === "stripe" ? "Carte (en ligne)" : p.moyen}</span>
              <span className="font-medium text-green-700">{eur(p.montant)}</span>
              <span className="text-xs text-gray-500">{dateFr(p.paye_at)}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-sm">
            <span className="font-medium text-gray-700">Reste dû</span>
            <span className={resteDu > 0 ? "font-semibold text-red-700" : "font-semibold text-green-700"}>{eur(resteDu)}</span>
          </div>
        </Card>
      )}

      {avoirs.length > 0 && (
        <Card className="flex flex-col gap-1">
          <div className="text-sm font-semibold">Avoirs sur cette facture</div>
          {avoirs.map((a) => (
            <Link key={a.id} href={`/factures/${a.id}`} className="flex items-center justify-between border-b border-gray-50 py-1.5 text-sm last:border-0">
              <span className="text-gray-700 underline underline-offset-2">{a.numero ?? "Brouillon d'avoir"}</span>
              <Badge tone={STATUS_FACTURE[a.status]?.ton}>{STATUS_FACTURE[a.status]?.label ?? a.status}</Badge>
              <span className="font-medium">{eur(a.total_ttc)}</span>
            </Link>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-2 text-sm">
            <span className="font-medium text-gray-700">Crédit encore possible</span>
            <span className="font-semibold">{eur(creditRestant)}</span>
          </div>
        </Card>
      )}

      {/* Corriger, annuler, refaire. Ces trois chemins manquaient : une facture émise était un
          document sans issue, et le statut « annulée » était lu partout sans qu'aucun bouton ne
          puisse le poser. */}
      {!annulee && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Corriger cette facture</div>
          <div className="flex flex-wrap gap-2">
            {!estAvoir && (
              <Button variant="secondary" onClick={dupliquer} loading={busy}>
                <span className="flex items-center gap-1.5"><Copy size={15} aria-hidden /> Dupliquer</span>
              </Button>
            )}
            {peutAvoir && (
              <Button variant="secondary" onClick={() => { setPanneauAvoir(!panneauAvoir); setPanneauAnnuler(false); }}>
                <span className="flex items-center gap-1.5"><RotateCcw size={15} aria-hidden /> Faire l&apos;avoir</span>
              </Button>
            )}
            {peutAnnuler && (
              <Button variant="danger" onClick={() => { setPanneauAnnuler(!panneauAnnuler); setPanneauAvoir(false); }}>
                <span className="flex items-center gap-1.5"><Ban size={15} aria-hidden /> Annuler la facture</span>
              </Button>
            )}
            {/* Le brouillon est le seul état jetable : une facture émise est une pièce comptable,
                et la base refuse de la mettre à la corbeille en disant d'émettre un avoir. Le
                bouton n'est proposé que là où il aboutit, plutôt que d'offrir un refus. */}
            {facture.status === "brouillon" && (
              <BoutonCorbeille
                entite="facture"
                id={facture.id}
                libelle={facture.numero ?? "ce brouillon"}
                variant="ghost"
                onSupprime={() => router.push("/factures")}
              />
            )}
          </div>
          {facture.status === "emise" && encaisse > 0 && (
            <p className="text-xs text-gray-500">
              Un règlement a déjà été enregistré : cette facture ne s&apos;annule plus. La correction
              passe par un avoir, qui laisse une trace symétrique dans vos comptes.
            </p>
          )}
          {facture.status === "payee" && (
            <p className="text-xs text-gray-500">
              Une facture payée ne s&apos;annule pas — il y a de l&apos;argent encaissé en face. L&apos;avoir est la
              seule correction qui se voit dans le journal des ventes.
            </p>
          )}
          {facture.status === "brouillon" && (
            <p className="text-xs text-gray-500">
              Ce brouillon n&apos;a jamais existé pour votre client : modifiez-le directement ci-dessous.
              Ni annulation, ni avoir ne s&apos;appliquent tant qu&apos;il n&apos;est pas émis.
            </p>
          )}
        </Card>
      )}

      {panneauAnnuler && (
        <Card className="flex flex-col gap-2 border-danger">
          <div className="text-sm font-semibold text-danger-dark">Annuler la facture {facture.numero}</div>
          <Textarea
            label="Motif de l'annulation *"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : facture émise sur le mauvais client, chantier annulé avant démarrage…"
          />
          <p className="text-xs text-gray-500">
            Le numéro {facture.numero} restera consommé : une numérotation comptable est
            chronologique et continue, on ne réutilise jamais le numéro d&apos;une facture annulée.
            La facture sortira de l&apos;export FEC et ses bons de livraison repartiront libres.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPanneauAnnuler(false)} disabled={busy}>Retour</Button>
            <Button variant="danger" className="flex-1" onClick={annuler} loading={busy} disabled={!motif.trim()}>
              Annuler définitivement
            </Button>
          </div>
        </Card>
      )}

      {panneauAvoir && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Faire l&apos;avoir de la facture {facture.numero}</div>
          <p className="text-xs text-gray-500">
            L&apos;avoir reprend les lignes, la remise et les mentions de la facture, et prend un numéro
            de la série AV-. Il part en brouillon : rien n&apos;est envoyé tant que vous ne l&apos;émettez pas.
            {dejaCredite > 0 && ` ${eur(dejaCredite)} ont déjà été crédités sur cette facture, il reste ${eur(creditRestant)}.`}
          </p>
          <div className="flex flex-col gap-1 rounded-lg border border-gray-200 p-2">
            <div className="text-xs font-medium text-gray-600">Avoir partiel — cochez les lignes à créditer</div>
            {facture.items.map((it, i) => (
              <label key={i} className="flex items-start gap-2 border-b border-gray-50 py-1.5 text-sm last:border-0">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand"
                  checked={lignesAvoir.includes(i)}
                  onChange={(e) => setLignesAvoir(e.target.checked ? [...lignesAvoir, i] : lignesAvoir.filter((x) => x !== i))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{it.libelle || "Ligne sans libellé"}{estDeductionAcompte(it) ? " (déduction d'acompte)" : ""}</span>
                  <span className="block text-xs text-gray-500">{qteFr(it.qte, it.unite)} · TVA {nombreFr(it.tva)} %</span>
                </span>
                <span className="whitespace-nowrap text-sm font-medium">{eur(it.total_ht)} HT</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => creerAvoir(true)} loading={busy}>
              Avoir total ({eur(facture.total_ttc)})
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => creerAvoir(false)} loading={busy} disabled={lignesAvoir.length === 0}>
              Avoir des {lignesAvoir.length} ligne{lignesAvoir.length > 1 ? "s" : ""} cochée{lignesAvoir.length > 1 ? "s" : ""}
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setPanneauAvoir(false)} disabled={busy}>Retour</Button>
        </Card>
      )}

      {/* Ce que le logiciel écrit au client en votre nom. Absent des brouillons et des avoirs :
          on ne relance pas un document qu'on doit de l'argent. */}
      {facture.status !== "brouillon" && !estAvoir && (
        <ReglagesRelances
          type="facture"
          id={facture.id}
          clientId={facture.client_id}
          clientNom={facture.clients?.nom}
          depart={facture.due_date}
          relanceCount={facture.relance_count ?? 0}
          derniereRelanceAt={facture.derniere_relance_at}
          relancesActives={facture.relances_actives ?? true}
          eligible={facture.status === "emise" && resteDu > 0.01}
          onChange={reload}
        />
      )}

      <div className={`text-sm ${factureEchue(facture) ? "font-medium text-danger-dark" : "text-gray-500"}`}>
        Client : <b className="text-gray-800">{facture.clients?.nom}</b> · {eur(facture.total_ttc)} TTC
        {facture.due_date ? ` · ${factureEchue(facture) ? "échue le" : "échéance"} ${dateFr(facture.due_date)}` : ""}
      </div>
      <FactureEditor factureId={id} />

      {/* Une facture émise est figée par `trg_figer_document` : ce qu'on lit ici, ce sont surtout
          les corrections d'avant émission, l'annulation et son motif. C'est exactement ce qu'un
          contrôle ou un client demande. */}
      <Historique entite="factures" entiteId={id} />
    </div>
  );
}
