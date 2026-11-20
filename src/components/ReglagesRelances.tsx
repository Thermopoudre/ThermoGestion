"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { useToast } from "@/components/Toast";
import { useAlertes } from "@/components/AlertesProvider";
import { usePlan } from "@/components/PlanProvider";
import { Badge, Button, Card } from "@/components/ui";
import { MOTIF_RELANCE, etatRelance, sortRelance, type DocumentRelancable } from "@/lib/alertes";
// D13 — `dateHeureFr` vivait ici ET dans `/relances`, avec deux styles différents sous le même
// nom. La seule définition qui fait foi est désormais `lib/utils.ts`.
import { dateHeureFr } from "@/lib/utils";

/** Une relance déjà partie, telle que la vue `relances_envoyees` la rend. */
type Envoyee = {
  id: string;
  sent_at: string;
  destinataire: string | null;
  destinataire_client: string | null;
  trace_disponible: boolean | null;
  statut_envoi: string;
  erreur_envoi: string | null;
};

/**
 * Le panneau « ce que le logiciel écrit à votre client », sur la fiche d'un devis ou d'une facture.
 *
 * POURQUOI cet écran existe. `relances_actives`, `relance_count` et `derniere_relance_at` étaient
 * écrites par le cron et **n'apparaissaient nulle part** dans l'application. L'atelier ne pouvait
 * ni voir ni couper une relance envoyée en son nom. Le jour où un gros donneur d'ordre appelle pour
 * dire qu'il en a assez d'être relancé par une machine, il n'y avait aucun bouton — juste une
 * explication embarrassée.
 *
 * Trois choses, et pas une de plus : ce qui est déjà parti, quand part la prochaine, comment
 * l'arrêter. Deux interrupteurs, parce qu'il y a deux façons d'arrêter : ce document-ci, ou ce
 * client pour toujours.
 */
export default function ReglagesRelances({
  type,
  id,
  clientId,
  clientNom,
  depart,
  relanceCount,
  derniereRelanceAt,
  relancesActives,
  eligible,
  onChange,
}: {
  type: "devis" | "facture";
  id: string;
  clientId: string | null;
  clientNom?: string | null;
  /** `envoye_at` pour un devis, `due_date` pour une facture : le point de départ du décompte. */
  depart: string | null;
  relanceCount: number;
  derniereRelanceAt: string | null;
  relancesActives: boolean;
  /** Le document est-il dans un état qui appelle une relance (envoyé / émis et non soldé) ? */
  eligible: boolean;
  onChange?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const reglages = useAlertes();
  const { ouvert, commercial } = usePlan();
  const [clientActif, setClientActif] = useState<boolean | null>(null);
  const [envoyees, setEnvoyees] = useState<Envoyee[]>([]);
  const [busy, setBusy] = useState(false);

  const recharger = useCallback(async () => {
    const [{ data: cli }, { data: env }] = await Promise.all([
      clientId
        ? supabase.from("clients").select("relances_actives").eq("id", clientId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("relances_envoyees")
        .select("id, sent_at, destinataire, destinataire_client, trace_disponible, statut_envoi, erreur_envoi")
        .eq("document_type", type)
        .eq("document_id", id)
        .order("sent_at", { ascending: false }),
    ]);
    setClientActif((cli as { relances_actives: boolean } | null)?.relances_actives ?? null);
    setEnvoyees((env as Envoyee[]) ?? []);
  }, [supabase, clientId, type, id]);

  useEffect(() => { recharger(); }, [recharger]);

  // Le panneau parle d'argent et de ce qui part au nom de l'atelier : il n'a rien à faire devant
  // un compte de production. La base dit déjà non (la vue est fermée) ; ici on évite l'écran vide.
  if (!commercial) return null;

  const cadence = type === "devis" ? reglages.relance_devis_jours : reglages.relance_facture_jours;
  const etat = etatRelance(
    {
      depart,
      derniere_relance_at: derniereRelanceAt,
      relance_count: relanceCount,
      relances_actives: relancesActives,
      client_relances_actives: clientActif,
      eligible,
    } satisfies DocumentRelancable,
    cadence,
    reglages,
    ouvert("relances_auto"),
  );

  async function basculerDocument() {
    setBusy(true);
    const ok = await ecrire(
      supabase.from(type === "devis" ? "devis" : "factures").update({ relances_actives: !relancesActives }).eq("id", id),
      toast,
      relancesActives ? "Relances coupées sur ce document." : "Relances réactivées sur ce document.",
    );
    setBusy(false);
    if (ok) { await recharger(); onChange?.(); }
  }

  async function basculerClient() {
    if (!clientId) return;
    setBusy(true);
    const ok = await ecrire(
      supabase.from("clients").update({ relances_actives: !clientActif }).eq("id", clientId),
      toast,
      clientActif
        ? `${clientNom ?? "Ce client"} ne sera plus jamais relancé automatiquement.`
        : `${clientNom ?? "Ce client"} entre de nouveau dans la file de relance.`,
    );
    setBusy(false);
    if (ok) { await recharger(); onChange?.(); }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Relances automatiques</div>
        <Link href="/relances" className="text-xs text-brand underline underline-offset-2">
          Tout ce qui est parti →
        </Link>
      </div>

      {/* L'état, en une phrase. C'est la seule information que l'exploitant cherche quand son
          client l'appelle : « est-ce que vous allez encore m'écrire ? » */}
      <p className="flex items-center gap-1.5 text-sm">
        {etat.relancera ? (
          <>
            <BellRing size={15} aria-hidden className="text-brand" />
            <span>
              Prochaine relance le <b>{new Date(etat.prochaine).toLocaleDateString("fr-FR")}</b>
              {" "}— il en reste {etat.restantes} sur {reglages.relance_max}.
            </span>
          </>
        ) : (
          <>
            <BellOff size={15} aria-hidden className="text-gray-400" />
            <span className="text-gray-600">Aucune relance ne partira. {MOTIF_RELANCE[etat.motif]}</span>
          </>
        )}
      </p>

      {relanceCount > 0 && (
        <p className="text-xs text-gray-500">
          {relanceCount} relance{relanceCount > 1 ? "s" : ""} déjà envoyée{relanceCount > 1 ? "s" : ""}
          {derniereRelanceAt ? `, la dernière le ${new Date(derniereRelanceAt).toLocaleDateString("fr-FR")}` : ""}.
        </p>
      )}

      {envoyees.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-gray-50 p-2">
          {envoyees.map((e) => {
            const st = sortRelance(e);
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                <span>{dateHeureFr(e.sent_at)} · {st.destinataire}</span>
                <Badge tone={st.ton}>{st.badge}</Badge>
                {/* La même phrase que sur /relances, au même endroit : un badge qui inquiète sur
                    une fiche et s'explique ailleurs ne s'explique nulle part. */}
                {st.explication && <span className="w-full text-gray-500">{st.explication}</span>}
                {e.erreur_envoi && <span className="w-full text-danger">{e.erreur_envoi}</span>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={basculerDocument} loading={busy}>
          {relancesActives ? "Ne plus relancer ce document" : "Réactiver les relances ici"}
        </Button>
        {clientId && clientActif !== null && (
          <Button variant={clientActif ? "danger" : "secondary"} onClick={basculerClient} loading={busy}>
            {clientActif ? "Ne jamais relancer ce client" : "Réautoriser les relances de ce client"}
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Une relance part au plus tous les {cadence} jours, {reglages.relance_max} fois au maximum,
        et jamais sur un document soldé ou mis à la corbeille. L&apos;interrupteur du client vaut
        pour tous ses devis et toutes ses factures, d&apos;un coup — c&apos;est celui à utiliser
        quand un donneur d&apos;ordre demande qu&apos;on cesse de lui écrire.{" "}
        <Link href="/reglages?onglet=alertes" className="underline underline-offset-2">Régler la cadence</Link>.
      </p>
    </Card>
  );
}
