"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Eye, Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, PageTitle, Spinner } from "@/components/ui";
import type { TonBadge } from "@/lib/tons";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import {
  NIVEAU_PLAN,
  OFFRES,
  PRIX_SIEGE_ANNUEL,
  PRIX_SIEGE_MENSUEL,
  SIEGES_INCLUS,
  accesOuvert,
  coutSiegesMensuel,
  enEssai,
  joursRestantsEssai,
  nomPlan,
  offre,
  planEffectif,
  prixSiege,
  type Abonnement,
  type PlanCode,
  type Periode,
} from "@/lib/abonnement";
import { dateFr, eur, nombreFr } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";

type Sub = Abonnement & {
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
};

// Dixième table de statut du produit, locale à cet écran : elle passe au ton sémantique comme
// les neuf autres, pour qu'aucune couleur d'état ne subsiste en dur.
const LIBELLE_STATUT: Record<string, { texte: string; ton: TonBadge }> = {
  trialing: { texte: "Essai en cours", ton: "info" },
  active: { texte: "Actif", ton: "success" },
  past_due: { texte: "Paiement en retard", ton: "warning" },
  canceled: { texte: "Résilié", ton: "danger" },
  incomplete: { texte: "Paiement incomplet", ton: "warning" },
};

/** Ce que l'atelier a réellement produit : c'est ça qu'il perd l'accès à modifier, pas « ses données ». */
type Inventaire = { devis: number; projets: number; factures: number; clients: number };

/** Décompte rendu par `mes_sieges()` en base : la seule règle qui compte. */
type Sieges = { plan: string; inclus: number; supp: number; autorises: number; occupes: number };

/**
 * Les colonnes lues sur `subscriptions`. `sieges_supp` en fait partie : sans lui, `Abonnement`
 * arriverait avec un champ vide et tous les calculs de sièges de cet écran annonceraient zéro
 * siège acheté à un atelier qui en paie trois.
 */
const COLONNES_SUB =
  "plan, status, trial_end, apercu_plan, sieges_supp, periode, current_period_end, cancel_at_period_end, stripe_customer_id";

export default function AbonnementPage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [sub, setSub] = useState<Sub | null>(null);
  const [chargement, setChargement] = useState(true);
  const [periode, setPeriode] = useState<Periode>("mois");
  const [busy, setBusy] = useState<string>("");
  const [estProprietaire, setEstProprietaire] = useState(false);
  const [inv, setInv] = useState<Inventaire | null>(null);
  const [sieges, setSieges] = useState<Sieges | null>(null);

  useTitreDocument("Abonnement");

  async function recharger() {
    const [{ data: s }, { data: sg }] = await Promise.all([
      supabase.from("subscriptions").select(COLONNES_SUB).maybeSingle(),
      supabase.rpc("mes_sieges"),
    ]);
    setSub((s ?? null) as Sub | null);
    setSieges((sg ?? null) as Sieges | null);
  }

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: sg }, { data: membre }, devis, projets, factures, clients] = await Promise.all([
        supabase.from("subscriptions").select(COLONNES_SUB).maybeSingle(),
        supabase.rpc("mes_sieges"),
        supabase.from("users").select("role").maybeSingle(),
        supabase.from("devis").select("id", { count: "exact", head: true }),
        supabase.from("projets").select("id", { count: "exact", head: true }),
        supabase.from("factures").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }),
      ]);
      setSub((s ?? null) as Sub | null);
      setSieges((sg ?? null) as Sieges | null);
      setEstProprietaire(membre?.role === "owner");
      setInv({
        devis: devis.count ?? 0,
        projets: projets.count ?? 0,
        factures: factures.count ?? 0,
        clients: clients.count ?? 0,
      });
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("ok")) toast("Merci ! Votre abonnement est actif.");
    if (p.get("annule")) toast("Souscription annulée — rien n'a été débité.", "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // D3 — « Paiement non configuré sur le serveur. » est du jargon d'administrateur : un prospect
  // qui clique « Choisir » pendant que Stripe n'est pas encore branché doit lire un message
  // métier, pas un texte pensé pour l'agent qui configure les clés API. Le `code` renvoyé par la
  // route distingue ce cas précis des autres échecs (offre inconnue, Stripe en erreur…), qui
  // restent affichés tels quels — ce sont déjà des messages actionnables pour le responsable.
  function messageEchecPaiement(data: { error?: string; code?: string }, defaut: string) {
    if (data.code === "STRIPE_NON_CONFIGURE") {
      return "Le paiement en ligne n'est pas encore ouvert. Écrivez-nous à contact@thermopoudre.fr.";
    }
    return data.error ?? defaut;
  }

  async function souscrire(plan: PlanCode) {
    setBusy(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, periode }),
      });
      const data = await res.json().catch(() => ({} as { error?: string; code?: string }));
      if (!res.ok) { toast(messageEchecPaiement(data, "Impossible d'ouvrir le paiement."), "error"); return; }
      window.location.href = data.url;
    } catch {
      toast("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", "error");
    } finally {
      setBusy("");
    }
  }

  async function ouvrirPortail() {
    setBusy("portail");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({} as { error?: string; code?: string }));
      if (!res.ok) { toast(messageEchecPaiement(data, "Portail indisponible."), "error"); return; }
      window.location.href = data.url;
    } catch {
      toast("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", "error");
    } finally {
      setBusy("");
    }
  }

  /** Aperçu de formule pendant l'essai : ne peut que restreindre, jamais ouvrir (garde-fou en base). */
  async function apercu(plan: PlanCode | null) {
    setBusy(`apercu-${plan ?? "off"}`);
    const { error } = await supabase.rpc("apercu_formule", { p_plan: plan });
    setBusy("");
    if (error) { toast(errorFr(error), "error"); return; }
    await recharger();
    toast(plan ? `Vous voyez maintenant l'atelier comme en formule ${nomPlan(plan)}.` : "Essai complet rétabli.");
    // Le contexte de plan est posé par le layout serveur : sans rafraîchissement, les cadenas
    // du menu resteraient sur l'état précédent.
    window.location.reload();
  }

  if (chargement) return <Spinner />;

  const ouvert = accesOuvert(sub);
  const jours = joursRestantsEssai(sub);
  const essai = enEssai(sub);
  const effectif = planEffectif(sub);
  const statut = sub ? LIBELLE_STATUT[sub.status] ?? { texte: sub.status, ton: "neutral" as TonBadge } : null;
  const abonne = sub?.status === "active" || sub?.status === "past_due";

  // Ce que l'atelier paie réellement chaque mois : la formule **plus** les sièges. Aucun écran ne
  // donnait ce total, alors que c'est le seul chiffre que l'exploitant cherche quand il ouvre
  // cette page — il devait l'aller chercher sur son relevé bancaire.
  // La périodicité réellement souscrite est désormais enregistrée par le webhook Stripe : sans
  // elle, on affichait un total mensuel à un abonné annuel, c'est-à-dire un chiffre que sa banque
  // ne verra jamais. Tant qu'aucun abonnement payant n'est ouvert, elle est nulle et le mensuel
  // reste la lecture par défaut — c'est ce qui est proposé en premier à la souscription.
  const periodeFacturee: Periode = sub?.periode === "an" ? "an" : "mois";
  const parPeriode = periodeFacturee === "an" ? "an" : "mois";
  const prixFormuleMois =
    (periodeFacturee === "an" ? offre(sub?.plan)?.prixAnnuel : offre(sub?.plan)?.prixMensuel) ?? 0;
  const prixSiegesMois = Math.max(0, sub?.sieges_supp ?? 0) * prixSiege(periodeFacturee);
  const totalMois = prixFormuleMois + prixSiegesMois;

  return (
    <div className="flex flex-col gap-4 md:max-w-3xl">
      <PageTitle action={statut ? <Badge tone={statut.ton}>{statut.texte}</Badge> : undefined}>Abonnement</PageTitle>

      {!ouvert && (
        <Card className="border-red-200 bg-red-50">
          <div className="font-semibold text-red-800">Votre essai est terminé</div>
          <p className="mt-1 text-sm text-red-700">
            Rien n&apos;est perdu et rien n&apos;est effacé. Vos {inv?.devis ?? 0} devis,{" "}
            {inv?.projets ?? 0} projets, {inv?.factures ?? 0} factures et {inv?.clients ?? 0} clients
            restent consultables, imprimables et exportables. Ce que vous ne pouvez plus faire, c&apos;est
            en créer de nouveaux : pas de devis, pas d&apos;étape validée, pas de facture émise.
          </p>
          <p className="mt-2 text-sm text-red-700">
            Vous récupérez la main à la seconde où vous souscrivez, sur les mêmes données.
          </p>
        </Card>
      )}

      {ouvert && jours !== null && (
        <Card className={jours <= 7 ? "border-amber-200 bg-amber-50" : ""}>
          <div className="font-medium">
            Essai gratuit — {jours} jour{jours > 1 ? "s" : ""} restant{jours > 1 ? "s" : ""}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Aucune carte n&apos;a été demandée. Si vous souscrivez maintenant, vos jours d&apos;essai
            restants sont conservés : le premier prélèvement n&apos;aura lieu qu&apos;à la fin de la période.
          </p>
          {jours <= 7 && (
            <p className="mt-2 text-sm text-amber-900">
              Le {dateFr(sub?.trial_end)}, votre atelier passera en lecture seule : vous garderez
              tout sous les yeux — vos {inv?.devis ?? 0} devis, {inv?.projets ?? 0} projets et{" "}
              {inv?.factures ?? 0} factures — sans pouvoir créer ni modifier. Aucune donnée
              n&apos;est supprimée, jamais.
            </p>
          )}
        </Card>
      )}

      {/* Aperçu de formule — n'existe que pendant l'essai, et ne peut que restreindre.
          Un exploitant qui hésite a besoin de voir ce qu'il perd, pas seulement ce qu'il gagne. */}
      {essai && estProprietaire && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Eye size={15} aria-hidden /> Voir l&apos;atelier comme dans une formule
          </div>
          <p className="text-sm text-gray-600">
            Pendant l&apos;essai, tout est ouvert. Pour comparer, vous pouvez regarder votre atelier
            comme si vous étiez dans une formule donnée : les écrans qu&apos;elle ne couvre pas se
            ferment, vos données ne bougent pas, et vous revenez à l&apos;essai complet en un clic.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => apercu(null)}
              disabled={!!busy}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${!sub?.apercu_plan ? "bg-brand text-white" : "bg-gray-100 text-gray-600"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
            >
              Essai complet
            </button>
            {OFFRES.map((o) => (
              <button
                key={o.code}
                type="button"
                onClick={() => apercu(o.code)}
                disabled={!!busy}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${sub?.apercu_plan === o.code ? "bg-brand text-white" : "bg-gray-100 text-gray-600"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
              >
                {o.nom}
              </button>
            ))}
          </div>
          {sub?.apercu_plan && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <Lock size={12} aria-hidden />
              Aperçu « {nomPlan(sub.apercu_plan)} » en cours — certains écrans sont volontairement fermés.
            </p>
          )}
        </Card>
      )}

      {abonne ? (
        <Card className="flex flex-col gap-3">
          <div>
            <div className="text-sm text-gray-500">Formule</div>
            <div className="text-lg font-semibold">{nomPlan(sub?.plan)}</div>
          </div>
          {sub?.current_period_end && (
            <p className="text-sm text-gray-600">
              {sub.cancel_at_period_end
                ? `Résiliation prévue le ${dateFr(sub.current_period_end)} — vous gardez l'accès jusque-là.`
                : `Prochaine échéance le ${dateFr(sub.current_period_end)}.`}
            </p>
          )}
          {sub?.status === "past_due" && (
            <p className="text-sm text-amber-800">
              Le dernier prélèvement a échoué. Mettez votre moyen de paiement à jour pour éviter la coupure.
            </p>
          )}
          {estProprietaire && (
            <Button variant="secondary" onClick={ouvrirPortail} loading={busy === "portail"}>
              Gérer mon abonnement, ma carte et mes factures
            </Button>
          )}
        </Card>
      ) : null}

      {/* Utilisateurs — occupés, inclus, achetés, et le total réellement facturé.
          Le nombre d'utilisateurs n'est plus une marche entre formules : c'est une ligne de
          facture, et une ligne de facture se lit. */}
      {sieges && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Users size={15} aria-hidden /> Utilisateurs
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { t: "Occupés", v: String(sieges.occupes), s: "actifs + invitations" },
              { t: "Compris dans la formule", v: String(sieges.inclus), s: nomPlan(sieges.plan) },
              { t: "Sièges achetés", v: String(sieges.supp), s: sieges.supp > 0 ? `${eur(prixSiegesMois)} HT / ${parPeriode}` : "aucun" },
              { t: "Places libres", v: String(Math.max(0, sieges.autorises - sieges.occupes)), s: `sur ${sieges.autorises}` },
            ].map((c) => (
              <div key={c.t} className="rounded-lg bg-gray-50 p-2">
                <dt className="text-[11px] uppercase tracking-wide text-gray-500">{c.t}</dt>
                <dd className="font-display text-xl font-bold">{c.v}</dd>
                <dd className="text-[11px] text-gray-500">{c.s}</dd>
              </div>
            ))}
          </dl>

          {abonne ? (
            <div className="rounded-lg border border-gray-200 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Formule {nomPlan(sub?.plan)}</span>
                <span>{eur(prixFormuleMois)} HT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {sieges.supp} siège{sieges.supp > 1 ? "s" : ""} supplémentaire{sieges.supp > 1 ? "s" : ""} × {prixSiege(periodeFacturee)} €
                </span>
                <span>{eur(prixSiegesMois)} HT</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-semibold">
                <span>Total facturé</span>
                <span>{eur(totalMois)} HT / {parPeriode}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {/* D6 — un montant à quatre chiffres interpolé brut rend « 2490 € HT » : ni virgule
                    ni espace de milliers françaises. `nombreFr` pose le séparateur attendu. */}
                {sub?.periode === "an"
                  ? `Vous êtes engagé à l'année : deux mois sont offerts sur la formule comme sur les sièges.`
                  : sub?.periode === "mois"
                    ? `Facturé au mois, sans engagement. À l'année, la même formule reviendrait à ${nombreFr(offre(sub?.plan)?.prixAnnuel)} € HT et le siège à ${nombreFr(PRIX_SIEGE_ANNUEL)} € HT — deux mois offerts.`
                    : `Montants au tarif mensuel. À l'année : ${nombreFr(offre(sub?.plan)?.prixAnnuel)} € HT pour la formule et ${nombreFr(PRIX_SIEGE_ANNUEL)} € HT par siège, deux mois offerts dans les deux cas.`}
              </p>
            </div>
          ) : essai ? (
            <p className="text-sm text-gray-600">
              Pendant l&apos;essai, {sieges.inclus} sièges sont ouverts : faites entrer votre équipe pour
              de vrai, il n&apos;y a rien à acheter. Chaque formule comprend ensuite son propre nombre de
              sièges — {OFFRES.map((o) => `${o.nom} ${SIEGES_INCLUS[o.code]}`).join(", ")} — et le siège
              au-delà se paie {PRIX_SIEGE_MENSUEL} € HT par mois, {PRIX_SIEGE_ANNUEL} € HT par an.
            </p>
          ) : null}

          <Link href="/reglages" className="text-sm font-medium text-brand underline">
            Gérer l&apos;équipe et les sièges →
          </Link>
        </Card>
      )}

      <div className="flex items-center justify-center gap-2">
        {(["mois", "an"] as Periode[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriode(p)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${periode === p ? "bg-brand text-white" : "bg-gray-100 text-gray-600"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
          >
            {p === "mois" ? "Mensuel" : "Annuel — 2 mois offerts"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {OFFRES.map((o) => {
          const courant = abonne && sub?.plan === o.code;
          const vu = effectif === o.code;
          // Monter en formule rend des sièges payés inutiles : l'écart de prix affiché brut est
          // trompeur pour un atelier qui paie déjà trois sièges. On lui dit ce qu'il récupère.
          const monte = abonne && !!sub && NIVEAU_PLAN[o.code] > NIVEAU_PLAN[planEffectif(sub)];
          const siegesRendus = monte
            ? Math.min(sieges?.supp ?? 0, SIEGES_INCLUS[o.code] - SIEGES_INCLUS[planEffectif(sub)])
            : 0;
          return (
            <Card key={o.code} className={`flex flex-col gap-3 ${courant ? "border-brand ring-1 ring-brand" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold">{o.nom}</span>
                  {courant && <Badge tone="success">Votre formule</Badge>}
                  {!courant && vu && essai && <Badge tone="info">Ce que vous voyez</Badge>}
                </div>
                <p className="text-sm text-gray-600">{o.argument}</p>
              </div>
              <div>
                <span className="font-display text-2xl font-bold">
                  {eur(periode === "an" ? o.prixAnnuel : o.prixMensuel)}
                </span>
                <span className="text-sm text-gray-500"> HT / {periode === "an" ? "an" : "mois"}</span>
              </div>
              <p className="text-xs italic text-gray-500">{o.raison}</p>
              {/* Le nombre de sièges est le premier critère de choix depuis que c'est un compteur
                  linéaire : il se lit sur la carte, pas au fond d'une liste à puces. */}
              <p className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                <b>{SIEGES_INCLUS[o.code]} utilisateurs inclus</b>, puis {prixSiege(periode)} € HT par
                utilisateur et par {periode === "an" ? "an" : "mois"}.
              </p>
              {siegesRendus > 0 && (
                <p className="rounded-lg bg-success-light/60 px-2 py-1.5 text-xs text-success-dark">
                  Vous payez {sieges?.supp} siège{(sieges?.supp ?? 0) > 1 ? "s" : ""} supplémentaire
                  {(sieges?.supp ?? 0) > 1 ? "s" : ""} : {siegesRendus} deviendrai{siegesRendus > 1 ? "ent" : "t"} inutile
                  {siegesRendus > 1 ? "s" : ""} en formule {o.nom}, soit {eur(siegesRendus * prixSiege(periode))} HT
                  de moins par {periode === "an" ? "an" : "mois"} sur la ligne des sièges.
                </p>
              )}
              <ul className="flex flex-1 flex-col gap-1 text-sm text-gray-700">
                {/* La ligne « N utilisateurs inclus » de `OFFRES` est déjà affichée en clair
                    au-dessus, avec le prix de la période choisie : la répéter ici la ferait lire
                    deux fois, dont une au tarif mensuel même en affichage annuel. */}
                {o.inclus.filter((i) => !/utilisateurs inclus/i.test(i)).map((i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check size={14} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              {estProprietaire ? (
                <Button onClick={() => souscrire(o.code)} loading={busy === o.code} disabled={courant}>
                  {courant ? "Formule en cours" : `Choisir ${o.nom}`}
                </Button>
              ) : (
                <p className="text-xs text-gray-500">Seul le responsable de l&apos;atelier peut souscrire.</p>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-500">
        Paiement sécurisé par Stripe. Sans engagement : vous arrêtez quand vous voulez, et vos
        données restent exportables.
      </p>
    </div>
  );
}
