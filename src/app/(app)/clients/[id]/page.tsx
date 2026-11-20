"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ClientForm from "@/components/ClientForm";
import ConfirmModal from "@/components/Modal";
import PiecesJointes from "@/components/PiecesJointes";
import PortailReglage from "@/components/PortailReglage";
import Historique from "@/components/Historique";
import BoutonCorbeille from "@/components/BoutonCorbeille";
import { ecrire } from "@/lib/db";
import { useToast } from "@/components/Toast";
import { Button, Card, PageTitle, Spinner } from "@/components/ui";
import { errorFr } from "@/lib/errors";
import { eur } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import type { Client } from "@/lib/types";

/** Une ligne de `balance_agee()` (C3), restreinte à ce client. */
type BalanceLigne = { tranche_0_30: number; tranche_31_60: number; tranche_61_90: number; tranche_plus_90: number; total_du: number };

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [askArchive, setAskArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  // C3 — balance âgée de ce client seul : `balance_agee()` rend tous les clients de l'atelier, on
  // ne garde que la ligne qui nous concerne. `undefined` = pas encore chargé, `null` = pas de retard.
  const [retard, setRetard] = useState<BalanceLigne | null | undefined>(undefined);

  async function recharger() {
    const supabase = createClient();
    const [{ data }, { data: bal }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.rpc("balance_agee"),
    ]);
    setClient(data as Client);
    const ligne = ((bal as (BalanceLigne & { client_id: string })[]) ?? []).find((l) => l.client_id === id);
    setRetard(ligne ?? null);
  }
  useEffect(() => { recharger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useTitreDocument(client?.nom ?? "Client");

  if (!client) return <Spinner />;

  /**
   * Désarchiver.
   *
   * Il manquait purement et simplement : `archive = true` était le seul retrait possible sur un
   * client, et **aucun écran ne permettait de revenir en arrière**. Archiver par erreur était
   * irréversible depuis l'interface — il fallait passer par la base.
   */
  async function desarchiver() {
    setBusy(true);
    if (await ecrire(createClient().from("clients").update({ archive: false }).eq("id", id), toast, "Client réactivé")) {
      await recharger();
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle
        action={
          client.archive ? (
            <Button variant="secondary" loading={busy} onClick={desarchiver}>Désarchiver</Button>
          ) : (
            <Button variant="secondary" onClick={() => setAskArchive(true)}>Archiver</Button>
          )
        }
      >
        {client.nom}
      </PageTitle>

      {client.archive && (
        <Card className="border-warning bg-warning-light text-sm text-warning-dark">
          Ce client est <b>archivé</b> : il n&apos;apparaît plus dans les listes ni dans la recherche.
          Son historique est intact et il redevient actif d&apos;un seul clic sur « Désarchiver ».
        </Card>
      )}

      {/* C3 — retard de paiement de ce client, en tranches. Absente si la RLS ne rend rien (rôle
          atelier, sans accès commercial) ou si le client est à jour. */}
      {retard && retard.total_du > 0 && (
        <Card className="border-danger-light bg-danger-light/40">
          <div className="text-sm font-semibold text-danger-dark">{eur(retard.total_du)} de retard de paiement</div>
          <dl className="mt-1 grid grid-cols-4 gap-2 text-xs text-gray-700">
            <div><dt className="text-gray-500">0-30 j</dt><dd className="font-medium">{eur(retard.tranche_0_30)}</dd></div>
            <div><dt className="text-gray-500">31-60 j</dt><dd className="font-medium">{eur(retard.tranche_31_60)}</dd></div>
            <div><dt className="text-gray-500">61-90 j</dt><dd className="font-medium">{eur(retard.tranche_61_90)}</dd></div>
            <div><dt className="text-gray-500">90+ j</dt><dd className="font-medium">{eur(retard.tranche_plus_90)}</dd></div>
          </dl>
          <a
            href={`/api/pdf/releve/${id}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-brand underline underline-offset-2"
          >
            Relevé de compte (PDF)
          </a>
        </Card>
      )}

      <ClientForm initial={client} />

      {/* Le lien que ce client ouvrira pour voir où en sont ses pièces sans écrire un mail.
          Placé juste sous la fiche : c'est au moment où on saisit ou vérifie les coordonnées
          qu'on décide de lui donner un accès, pas au fond de la page. */}
      <PortailReglage clientId={id} clientNom={client.nom} />

      {/* Le plan du client, son bon de commande, son cahier des charges. Jusqu'ici, tout ça vivait
          dans une boîte mail — et le jour du désaccord, la pièce qui protège l'atelier n'était pas
          dans le logiciel. */}
      <PiecesJointes
        entite="client"
        entiteId={id}
        atelierId={client.atelier_id}
        aide="Bon de commande, conditions négociées signées, attestation d'assurance : tout ce qui engage ce client et qu'il faudra retrouver."
      />

      {/* Une remise permanente qui passe de 0 à 15 %, une adresse de facturation changée la veille
          d'une échéance : c'est ici que ça se retrouve, et nulle part ailleurs. */}
      <Historique entite="clients" entiteId={id} />

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        <div className="text-sm font-semibold text-gray-700">Retirer ce client</div>
        <p className="text-xs text-gray-500">
          Dans presque tous les cas, <b>archivez</b> : le client quitte les listes et son historique
          reste lisible. La corbeille n&apos;accepte qu&apos;une fiche créée par erreur, sans aucun devis,
          projet ni facture — sinon toutes ses pièces afficheraient un nom vide.
        </p>
        <div>
          <BoutonCorbeille entite="client" id={id} libelle={client.nom} />
        </div>
      </div>

      <ConfirmModal
        open={askArchive}
        title="Archiver ce client ?"
        message="Il n'apparaîtra plus dans la liste. Ses devis et projets sont conservés, et vous pourrez le réactiver depuis sa fiche à tout moment."
        confirmLabel="Archiver"
        busy={busy}
        onCancel={() => setAskArchive(false)}
        onConfirm={async () => {
          setBusy(true);
          const { error } = await createClient().from("clients").update({ archive: true }).eq("id", id);
          if (error) { toast(errorFr(error), "error"); setBusy(false); return; }
          toast("Client archivé");
          router.push("/clients");
          router.refresh();
        }}
      />
    </div>
  );
}
