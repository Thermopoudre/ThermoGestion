"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import ConfirmModal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import { CORBEILLE, messageMiseALaCorbeille, type EntiteCorbeille } from "@/lib/corbeille";

/**
 * « Mettre à la corbeille », posé sur une fiche.
 *
 * Un seul composant pour les six entités, parce que le geste est le même partout et que la
 * différence — ce qu'on a le droit de jeter — est tranchée en base, par le trigger `corbeille`.
 * L'écran ne devine rien : il propose, la base refuse et **dit quoi faire à la place** (une
 * facture émise s'annule, un bon déjà facturé attend un avoir). C'est le seul découpage qui ne
 * puisse pas mentir.
 */
export default function BoutonCorbeille({
  entite,
  id,
  libelle,
  variant = "danger",
  className,
  onSupprime,
}: {
  entite: EntiteCorbeille;
  id: string;
  /** Ce que l'exploitant lit dans la confirmation : le numéro du devis, le nom du client. */
  libelle: string;
  variant?: "danger" | "secondary" | "ghost";
  className?: string;
  /** Si absent, on retombe sur la liste de l'entité — rester sur une fiche jetée n'a pas de sens. */
  onSupprime?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [demande, setDemande] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * L'écriture passe par une RPC, jamais par un `update deleted_at` direct.
   *
   * Ce n'est pas une préférence de style : PostgREST ajoute toujours un `RETURNING`, et
   * PostgreSQL applique alors la clause `using` de la politique à la ligne telle qu'elle sort de
   * l'écriture. Comme cette clause porte `deleted_at is null` — c'est tout l'intérêt du
   * dispositif — la ligne fraîchement supprimée ne la satisfait plus et l'écriture est refusée.
   * Voir le commentaire de `public.mettre_a_la_corbeille`.
   */
  async function jeter() {
    setBusy(true);
    const ok = await ecrire(
      createClient().rpc("mettre_a_la_corbeille", { p_entite: entite, p_id: id }),
      toast,
      `${CORBEILLE[entite].singulier} mis à la corbeille`,
    );
    setBusy(false);
    if (!ok) { setDemande(false); return; }
    if (onSupprime) { onSupprime(); return; }
    router.push(CORBEILLE[entite].liste);
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setDemande(true)}>
        <span className="flex items-center gap-1.5"><Trash2 size={16} aria-hidden /> Mettre à la corbeille</span>
      </Button>
      <ConfirmModal
        open={demande}
        title={`Mettre ce ${CORBEILLE[entite].singulier.toLowerCase()} à la corbeille ?`}
        message={messageMiseALaCorbeille(entite, libelle)}
        confirmLabel="Mettre à la corbeille"
        danger
        busy={busy}
        onCancel={() => setDemande(false)}
        onConfirm={jeter}
      />
    </>
  );
}
