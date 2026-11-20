"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Copy, GitBranch, PenLine, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import DevisEditor from "@/components/DevisEditor";
import ReglagesRelances from "@/components/ReglagesRelances";
import PartagerLien from "@/components/PartagerLien";
import EnvoyerDocument from "@/components/EnvoyerDocument";
import BoutonCorbeille from "@/components/BoutonCorbeille";
import Historique from "@/components/Historique";
import ConfirmModal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { track } from "@/lib/track";
import { Badge, Button, Card, PageTitle, Spinner } from "@/components/ui";
import { useTitreDocument } from "@/lib/titre";
import { STATUS_DEVIS, calcTotaux, dateFr, eur, nombreFr } from "@/lib/utils";
import { echeanceIso, joursPaiement, lignesAcompteDepuisDevis, montantAcompte } from "@/lib/calculs";
import { bloqueParLaValidite, echeanceDevisAffichable, joursRestantsDevis } from "@/lib/devis";
import { errorFr } from "@/lib/errors";
import { lignesJantesOuvrables } from "@/lib/jantes";
import type { Devis } from "@/lib/types";

/** Un maillon de la chaîne des versions, réduit à ce que la fiche affiche. */
type Maillon = { id: string; numero: string | null; version: number };

/** Les confirmations qui coûtent un clic parce que ce qu'elles font coûte beaucoup plus cher. */
type Confirmation = "refuser" | "rouvrir" | "version" | null;

export default function DevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [devis, setDevis] = useState<Devis | null>(null);
  const [factureId, setFactureId] = useState<string | null>(null);
  const [factureAcompteId, setFactureAcompteId] = useState<string | null>(null);
  const [projetId, setProjetId] = useState<string | null>(null);
  // Le chaînage des versions, dans les deux sens : d'où vient ce devis, et qui l'a remplacé.
  const [parent, setParent] = useState<Maillon | null>(null);
  const [successeur, setSuccesseur] = useState<Maillon | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const toast = useToast();

  async function reload() {
    const { data } = await supabase.from("devis").select("*, clients(nom, email)").eq("id", id).single();
    const d = data as unknown as Devis | null;
    setDevis(d);
    const [{ data: f }, { data: fa }, { data: p }, { data: suiv }] = await Promise.all([
      supabase.from("factures").select("id").eq("devis_id", id).eq("type", "solde").maybeSingle(),
      // Un devis n'a jamais qu'une seule facture d'acompte : `type` la distingue de la facture de
      // solde ci-dessus, toutes deux rattachées au même `devis_id`.
      supabase.from("factures").select("id").eq("devis_id", id).eq("type", "acompte").maybeSingle(),
      supabase.from("projets").select("id").eq("devis_id", id).maybeSingle(),
      // `limit(1)` plutôt qu'un `maybeSingle()` nu : la base garantit un seul successeur (on ne
      // versionne pas un devis déjà remplacé), mais une donnée héritée ne doit pas faire tomber
      // la fiche en erreur.
      supabase.from("devis").select("id, numero, version").eq("parent_id", id).order("version").limit(1).maybeSingle(),
    ]);
    setFactureId(f?.id ?? null);
    setFactureAcompteId(fa?.id ?? null);
    setProjetId(p?.id ?? null);
    setSuccesseur((suiv as Maillon | null) ?? null);
    if (d?.parent_id) {
      const { data: pa } = await supabase.from("devis").select("id, numero, version").eq("id", d.parent_id).maybeSingle();
      setParent((pa as Maillon | null) ?? null);
    } else setParent(null);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function creerFacture() {
    if (!devis) return;
    setBusy(true);
    // Échéance au délai négocié avec ce client (à défaut celui de l'atelier), et rattachement au
    // projet issu du devis : c'est ce `projet_id` qui alimente l'indicateur de marge de la fiche
    // projet, sinon le « Facturé » y reste vide même une fois la facture émise.
    const [{ data: cli }, { data: at }, { data: proj }] = await Promise.all([
      supabase.from("clients").select("delai_paiement_jours").eq("id", devis.client_id).maybeSingle(),
      supabase.from("ateliers").select("delai_paiement_jours").maybeSingle(),
      supabase.from("projets").select("id").eq("devis_id", id).maybeSingle(),
    ]);
    const jours = joursPaiement(cli?.delai_paiement_jours, at?.delai_paiement_jours);
    const { data, error } = await supabase.from("factures").insert({
      atelier_id: devis.atelier_id, client_id: devis.client_id, devis_id: id, projet_id: proj?.id ?? null, type: "solde",
      items: devis.items, remise: devis.remise,
      total_ht: devis.total_ht, total_tva: devis.total_tva, total_ttc: devis.total_ttc,
      due_date: echeanceIso(jours),
    }).select("id").single();
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    router.push(`/factures/${data.id}`);
  }

  /**
   * Facture d'acompte, au pourcentage demandé sur le devis (C1). Une seule ligne par taux de TVA,
   * construite par `lignesAcompteDepuisDevis` — c'est cette même répartition par taux que la
   * facture de solde relira pour déduire exactement ce qui a été appelé (`lignesDeductionAcomptes`,
   * inchangée par ce chantier).
   */
  async function creerFactureAcompte() {
    if (!devis || !devis.acompte_pct) return;
    setBusy(true);
    const [{ data: cli }, { data: at }, { data: proj }] = await Promise.all([
      supabase.from("clients").select("delai_paiement_jours").eq("id", devis.client_id).maybeSingle(),
      supabase.from("ateliers").select("delai_paiement_jours").maybeSingle(),
      supabase.from("projets").select("id").eq("devis_id", id).maybeSingle(),
    ]);
    const jours = joursPaiement(cli?.delai_paiement_jours, at?.delai_paiement_jours);
    const lignes = lignesAcompteDepuisDevis(devis.items, devis.acompte_pct, devis.remise);
    const totaux = calcTotaux(lignes, null);
    const { data, error } = await supabase.from("factures").insert({
      atelier_id: devis.atelier_id, client_id: devis.client_id, devis_id: id, projet_id: proj?.id ?? null, type: "acompte",
      items: lignes, remise: null, ...totaux,
      due_date: echeanceIso(jours),
    }).select("id").single();
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    router.push(`/factures/${data.id}`);
  }

  /**
   * Duplication et nouvelle version passent par une RPC, pas par un `insert` reconstruit ici.
   * POURQUOI : recopier douze lignes depuis le navigateur, c'est douze allers-retours et un devis
   * à moitié créé si le réseau lâche au milieu. La base le fait en une transaction, et c'est elle
   * qui décide de ce qui ne se duplique jamais — signature, numéro, jeton public, relances.
   */
  async function dupliquer() {
    setBusy(true);
    const { data, error } = await supabase.rpc("dupliquer_devis", { p_id: id });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Copie créée en brouillon");
    router.push(`/devis/${data as string}`);
  }

  async function nouvelleVersion() {
    setBusy(true);
    const { data, error } = await supabase.rpc("nouvelle_version_devis", { p_id: id });
    setBusy(false);
    setConfirmation(null);
    if (error) { toast(errorFr(error), "error"); return; }
    toast(`Version ${(devis?.version ?? 1) + 1} créée — l'ancienne passe en « remplacé »`);
    router.push(`/devis/${data as string}`);
  }

  async function rouvrir() {
    setBusy(true);
    const { error } = await supabase.rpc("rouvrir_devis", { p_id: id });
    setBusy(false);
    setConfirmation(null);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Devis repassé en brouillon — corrigez, puis refinalisez");
    await reload();
  }

  async function refuser() {
    setBusy(true);
    const ok = await ecrire(supabase.from("devis").update({ status: "refuse" }).eq("id", id), toast, "Devis marqué refusé");
    setBusy(false);
    setConfirmation(null);
    if (ok) await reload();
  }

  useTitreDocument(devis ? `Devis ${devis.numero ?? "brouillon"} — ${devis.clients?.nom ?? ""}` : null);

  if (!devis) return <Spinner />;

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/d/${devis.public_token}` : "";
  const remplace = devis.status === "remplace";
  // Le retour au brouillon n'est proposé que là où il est possible : la base refusera de toute
  // façon un devis signé ou remplacé, autant ne pas montrer le bouton.
  const peutRouvrir = ["envoye", "refuse", "expire"].includes(devis.status);
  const peutVersionner = devis.status !== "brouillon" && !remplace;

  // L'échéance de validité, telle que la base la calcule (`public.devis_echeance`) et telle
  // qu'elle est imprimée sur le devis. `perime` peut être vrai alors que le statut est encore
  // « envoyé » : le cron `expirer-devis` ne passe qu'une fois par jour, à 6 h 50, tandis que
  // `signer_devis` refuse dès la seconde où l'échéance est franchie. L'écran doit dire la
  // vérité de la base, pas celle de la colonne `status`.
  const echeance = echeanceDevisAffichable(devis);
  const perime = bloqueParLaValidite(devis);
  const joursRestants = joursRestantsDevis(devis);
  // Sur un brouillon, la validité n'a pas commencé à courir ; sur un devis signé, remplacé ou
  // refusé, elle n'a plus d'objet — un devis refusé l'est pour une autre raison, lui afficher
  // « validité dépassée » brouillerait le motif.
  const validiteAffichee = ["envoye", "expire"].includes(devis.status);

  // Amélioration n°8 (07/09/2026) — le bouton n'apparaît que s'il reste au moins une ligne de
  // jantes sans dossier physique ouvert : `jeux_jantes.devis_id` n'a pas de contrainte d'unicité,
  // le proposer sur une ligne déjà ouverte créerait un second dossier pour la même jante reçue.
  const aJanteAOuvrir = lignesJantesOuvrables(devis).length > 0;
  // Le dossier déjà ouvert pour ce devis, s'il existe. On lit la première ligne de jantes qui en
  // porte un : un devis ne chiffre qu'un jeu à la fois dans l'usage constaté, et s'il en portait
  // plusieurs, ouvrir le premier vaut mieux que n'offrir aucun chemin.
  const jeuJantesLie = (devis.items ?? [])
    .map((it) => it.meta?.jeu_jantes_id)
    .find((v): v is string => typeof v === "string" && v.length > 0);

  async function envoyer() {
    setBusy(true);
    let numero = devis!.numero;
    if (!numero) {
      const { data, error } = await supabase.rpc("next_numero", { p_type: "devis" });
      if (error) { toast(errorFr(error), "error"); setBusy(false); return; }
      numero = data as string;
    }
    const ok = await ecrire(
      supabase.from("devis").update({ status: "envoye", numero, envoye_at: new Date().toISOString() }).eq("id", id),
      toast,
      "Devis finalisé — lien client prêt",
    );
    if (ok) {
      track("devis_sent");
      await reload();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Badge tone={STATUS_DEVIS[devis.status]?.ton}>{STATUS_DEVIS[devis.status]?.label ?? devis.status}</Badge>}>
        {devis.numero ?? "Brouillon"}
      </PageTitle>

      {/* Le chaînage des versions, en une phrase lisible. Sans lui, `parent_id` et `version`
          resteraient ce qu'ils ont été pendant tout le projet : deux colonnes que personne ne voit. */}
      {(parent || successeur || devis.version > 1) && (
        <Card className="flex flex-col gap-1 border-purple-200 bg-purple-50 text-sm text-purple-900">
          <div className="flex items-center gap-1.5 font-medium">
            <GitBranch size={15} aria-hidden /> Version {devis.version}
          </div>
          {parent && (
            <p>
              Remplace le devis{" "}
              <Link href={`/devis/${parent.id}`} className="underline underline-offset-2">
                {parent.numero ?? "sans numéro"}
              </Link>
              {parent.version > 1 ? ` (version ${parent.version})` : ""}.
            </p>
          )}
          {successeur && (
            <p>
              Remplacé par la{" "}
              <Link href={`/devis/${successeur.id}`} className="font-semibold underline underline-offset-2">
                version {successeur.version}{successeur.numero ? ` — ${successeur.numero}` : " (brouillon)"}
              </Link>
              {" "}: c&apos;est elle qui fait foi.
            </p>
          )}
        </Card>
      )}

      {remplace && !successeur && (
        <Card className="border-purple-200 bg-purple-50 text-sm text-purple-900">
          Ce devis a été remplacé, mais sa version suivante n&apos;est plus accessible (elle a peut-être
          été supprimée). Dupliquez-le pour repartir de son contenu.
        </Card>
      )}

      {devis.status === "brouillon" && (
        <>
          <Button onClick={envoyer} loading={busy}>Finaliser et générer le lien client</Button>
          {/* La durée de validité n'était affichée nulle part dans l'application alors qu'elle
              s'imprime sur le devis. Depuis la migration 45 elle engage : autant l'annoncer
              avant de finaliser, pas après. */}
          <p className="-mt-2 text-xs text-gray-500">
            Une fois finalisé, ce devis sera valable <b>{devis.validite_jours} jours</b> : passé ce
            délai, le client ne pourra plus le signer.{" "}
            <Link href="/reglages" className="underline underline-offset-2">Changer la durée par défaut</Link>.
          </p>
        </>
      )}

      {/* L'échéance, en clair. « Valable jusqu'au 20 septembre » se lit et se décide plus vite
          que « valable 30 jours », des deux côtés du devis. */}
      {validiteAffichee && (
        perime ? (
          <Card className="flex flex-col gap-1 border-amber-200 bg-amber-50 text-sm text-amber-900">
            <div className="flex items-center gap-1.5 font-medium">
              <CalendarClock size={15} aria-hidden />
              Validité dépassée depuis le {dateFr(echeance)}
            </div>
            <p>
              Le client ne peut plus signer ce devis : le lien public refuse la signature, et la base
              refuserait aussi une signature saisie ici. <b>Revenir au brouillon</b> puis le refinaliser
              fait repartir la validité pour {devis.validite_jours} jours — c&apos;est le geste à faire si
              les prix n&apos;ont pas bougé. Sinon, <b>Nouvelle version</b> garde la trace de l&apos;ancienne offre.
            </p>
          </Card>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-gray-600">
            <CalendarClock size={15} aria-hidden />
            Signable jusqu&apos;au <b className="text-gray-800">{dateFr(echeance)}</b>
            {joursRestants === 0 ? " — dernier jour" : ` — encore ${joursRestants} jour${joursRestants > 1 ? "s" : ""}`}.
          </p>
        )
      )}

      {devis.status !== "brouillon" && !remplace && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-medium">Lien client (consultation + signature)</div>
          <PartagerLien
            url={publicUrl}
            titre={`Devis ${devis.numero ?? ""}`}
            texte="Voici votre devis, à consulter et à signer en ligne."
          />
          <EnvoyerDocument
            type="devis"
            id={devis.id}
            clientEmail={devis.clients?.email ?? null}
            mailtoHref={`mailto:?subject=${encodeURIComponent(`Devis ${devis.numero ?? ""}`)}&body=${encodeURIComponent(`Bonjour,%0A%0AVoici votre devis : ${publicUrl}`)}`.replace(/%250A/g, "%0A")}
          />
          {devis.signed_at && (
            <p className="flex items-center gap-1.5 text-sm text-success-dark">
              <PenLine size={15} aria-hidden /> Signé par {devis.signed_by} le {dateFr(devis.signed_at)} — projet créé automatiquement.
            </p>
          )}
        </Card>
      )}

      {devis.status === "signe" && (
        <div className="flex flex-wrap gap-2">
          {/* C1 — proposée d'un clic dès la signature, au bon montant : l'acompte est réclamé
              avant que l'atelier n'oublie de le faire. */}
          {(devis.acompte_pct ?? 0) > 0 && (
            factureAcompteId ? (
              <Button variant="secondary" onClick={() => router.push(`/factures/${factureAcompteId}`)}>Voir la facture d&apos;acompte</Button>
            ) : (
              <Button variant="secondary" onClick={creerFactureAcompte} loading={busy}>
                Facture d&apos;acompte ({nombreFr(devis.acompte_pct)} % = {eur(montantAcompte(devis.total_ttc, devis.acompte_pct))})
              </Button>
            )
          )}
          {factureId ? (
            <Button variant="secondary" onClick={() => router.push(`/factures/${factureId}`)}>Voir la facture</Button>
          ) : (
            <Button onClick={creerFacture} loading={busy}>Créer la facture</Button>
          )}
          {projetId && (
            <Button variant="secondary" onClick={() => router.push(`/bl/new?projet=${projetId}`)}>
              Créer le bon de livraison
            </Button>
          )}
          {/* Amélioration n°8 — évite de ressaisir à la réception ce qui vient d'être chiffré au
              téléphone : nombre, diamètre, dessin, finition et teinte partent préremplis, modifiables. */}
          {aJanteAOuvrir && (
            <Button variant="secondary" onClick={() => router.push(`/jantes/new?devis=${id}`)}>
              Créer le jeu de jantes
            </Button>
          )}
          {/* Le chemin inverse, tout aussi fréquent : les jantes arrivent à l'atelier, on ouvre le
              dossier, puis on chiffre depuis lui. Le devis portait alors le lien vers son dossier
              dans `meta.jeu_jantes_id` sans jamais l'afficher — on voyait « Voir le devis » depuis
              la fiche jantes, mais rien en sens inverse, et l'opérateur repartait chercher le
              dossier à la main dans la liste. */}
          {jeuJantesLie && (
            <Button variant="ghost" onClick={() => router.push(`/jantes/${jeuJantesLie}`)}>
              Voir le jeu de jantes
            </Button>
          )}
          {projetId && (
            <Button variant="ghost" onClick={() => router.push(`/projets/${projetId}`)}>Voir le projet</Button>
          )}
        </div>
      )}

      {devis.status === "envoye" && (
        <div className="flex flex-wrap gap-2">
          {/* L'accord verbal n'est plus proposé sur un devis périmé. Le client, lui, se voit
              refuser la signature par `signer_devis` : laisser l'atelier signer à sa place
              rouvrirait par la porte de service exactement ce que la base vient de fermer, et
              créerait le projet au prix d'une offre qui n'a plus cours. Le chemin est de
              repasser le devis en brouillon, ce que dit le bandeau juste au-dessus. */}
          {!perime && (
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await ecrire(
                  supabase.from("devis").update({ status: "signe", signed_at: new Date().toISOString(), signed_by: "Accepté verbalement" }).eq("id", id),
                  toast,
                  "Devis marqué signé — projet créé",
                );
                if (ok) { track("devis_signed"); await reload(); }
              }}
            >
              Marquer signé (accord verbal)
            </Button>
          )}
          {/* Un clic sur « Refusé » était jusqu'ici un cul-de-sac sans confirmation. Il en a une,
              et il n'est plus définitif : le retour au brouillon existe juste en dessous. */}
          <Button variant="danger" onClick={() => setConfirmation("refuser")}>Refusé</Button>
        </div>
      )}

      {/* Ce qu'on peut faire d'un devis, quel que soit son état. Dupliquer figure toujours en
          premier : c'est l'action la plus fréquente d'un logiciel de devis, et elle n'existait pas. */}
      <Card className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Reprendre ce devis</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={dupliquer} loading={busy}>
            <span className="flex items-center gap-1.5"><Copy size={15} aria-hidden /> Dupliquer</span>
          </Button>
          {peutRouvrir && (
            <Button variant="secondary" onClick={() => setConfirmation("rouvrir")}>
              <span className="flex items-center gap-1.5"><Undo2 size={15} aria-hidden /> Revenir au brouillon</span>
            </Button>
          )}
          {peutVersionner && (
            <Button variant="secondary" onClick={() => setConfirmation("version")}>
              <span className="flex items-center gap-1.5"><GitBranch size={15} aria-hidden /> Nouvelle version</span>
            </Button>
          )}
          {/* Sans ce bouton, la corbeille sait restaurer un devis mais rien ne peut l'y envoyer :
              le devis créé par erreur restait dans la liste pour toujours. La base refuse d'elle-même
              d'y jeter un devis déjà facturé, et le dit. */}
          <BoutonCorbeille
            entite="devis"
            id={devis.id}
            libelle={devis.numero ?? "ce brouillon"}
            variant="ghost"
            onSupprime={() => router.push("/devis")}
          />
        </div>
        <p className="text-xs text-gray-500">
          <b>Dupliquer</b> crée un devis neuf et indépendant, en brouillon, avec les mêmes lignes et
          la même remise — pour le client qui recommande la même chose.{" "}
          {peutVersionner && (
            <>
              <b>Nouvelle version</b> corrige celui-ci : la version {devis.version + 1} repart en
              brouillon et l&apos;actuelle passe en « remplacé », en gardant sa trace.{" "}
            </>
          )}
          {devis.status === "signe" && "Un devis signé ne se rouvre pas — il engage les deux parties, et le projet en découle."}
          {devis.status === "refuse" && "Un refus n'est pas définitif : le retour au brouillon rouvre la discussion."}
          {devis.status === "expire" && "Un devis expiré se rattrape : le retour au brouillon le rend modifiable, et sa refinalisation fait repartir la durée de validité à zéro. Le numéro et l'historique sont conservés."}
        </p>
      </Card>

      {/* Ce que le logiciel écrit au client en votre nom. Le panneau n'apparaît qu'une fois le
          devis parti : sur un brouillon, il n'y a rien à relancer et rien à couper. */}
      {/* Migration 76 — ce que ce devis porte comme conditions générales de vente. Figées au
          premier envoi (trg_figer_cgv) : elles ne bougent plus, même si Réglages → Atelier ou la
          fiche du client changent ensuite. */}
      {devis.status !== "brouillon" && (
        <Card className="flex flex-col gap-1 text-sm">
          <div className="font-medium text-gray-800">Conditions générales de vente</div>
          {devis.cgv_texte ? (
            <p className="text-xs text-gray-500">
              Ce devis porte les conditions figées à son envoi : elles ne changeront plus, quoi que
              vous modifiiez désormais dans les réglages de l&apos;atelier ou de ce client.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Aucune condition générale de vente n&apos;était renseignée au moment de l&apos;envoi de ce
              devis.
            </p>
          )}
        </Card>
      )}

      {devis.status !== "brouillon" && (
        <ReglagesRelances
          type="devis"
          id={devis.id}
          clientId={devis.client_id}
          clientNom={devis.clients?.nom}
          depart={devis.envoye_at}
          relanceCount={devis.relance_count ?? 0}
          derniereRelanceAt={devis.derniere_relance_at}
          relancesActives={devis.relances_actives ?? true}
          eligible={devis.status === "envoye"}
          onChange={reload}
        />
      )}

      <div className="text-sm text-gray-500">Client : <b className="text-gray-800">{devis.clients?.nom}</b> · {eur(devis.total_ttc)} TTC</div>
      <DevisEditor devisId={id} statutCourant={devis.status} />

      {/* Le cas d'usage qui a motivé tout ce chantier : « votre devis disait 1 400 €, la facture
          en fait 1 780 ». Le total, sa date de changement et son auteur sont ici. */}
      <Historique entite="devis" entiteId={id} />

      <ConfirmModal
        open={confirmation === "refuser"}
        title="Marquer ce devis refusé ?"
        message="Le client apparaîtra comme ayant décliné, et le devis sortira de la file de relance. Ce n'est pas définitif : vous pourrez le repasser en brouillon."
        confirmLabel="Marquer refusé"
        danger
        busy={busy}
        onConfirm={refuser}
        onCancel={() => setConfirmation(null)}
      />
      <ConfirmModal
        open={confirmation === "rouvrir"}
        title="Repasser ce devis en brouillon ?"
        message="Il redevient modifiable et sort de la file de relance. Le lien déjà envoyé au client reste consultable mais ne pourra plus être signé tant que le devis n'est pas refinalisé. À la refinalisation, la durée de validité repart de zéro : c'est ainsi qu'on rattrape un devis expiré."
        confirmLabel="Revenir au brouillon"
        busy={busy}
        onConfirm={rouvrir}
        onCancel={() => setConfirmation(null)}
      />
      <ConfirmModal
        open={confirmation === "version"}
        title={`Créer la version ${devis.version + 1} ?`}
        message={`Le devis ${devis.numero ?? "actuel"} passera en « remplacé » et gardera sa trace — signature comprise s'il en a une. La nouvelle version repart en brouillon et prendra son propre numéro à la finalisation.`}
        confirmLabel={`Créer la version ${devis.version + 1}`}
        busy={busy}
        onConfirm={nouvelleVersion}
        onCancel={() => setConfirmation(null)}
      />
    </div>
  );
}
