"use client";
import { useId } from "react";
import { Button } from "@/components/ui";
import { usePiegeFocus } from "@/components/usePiegeFocus";

/**
 * La boîte de confirmation du produit — 11 écrans l'utilisent.
 *
 * Deux corrections de fond ici :
 *
 * 1. **L'attente est visible.** Le bouton remplaçait son libellé par « … » pendant l'appel
 *    réseau : le composant qui a introduit `Button.loading` était donc le seul à ne pas s'en
 *    servir. Sur 4G, « Supprimer » devenait « … » et l'opérateur, ne sachant plus sur quoi il
 *    avait appuyé, réappuyait. `loading` conserve le libellé, affiche un rouet et neutralise le
 *    bouton.
 *
 * 2. **La modale se tient au clavier.** Échap ferme, le focus part sur « Annuler » (l'issue sûre :
 *    une confirmation ne se valide pas par une frappe distraite sur Entrée), Tab boucle dans la
 *    boîte, et le focus revient à sa place à la fermeture. Aucun des quatre n'existait.
 *
 * Échap et le clic sur le voile sont neutralisés pendant l'écriture : fermer la boîte n'annule pas
 * la requête déjà partie, ça ne fait que cacher son résultat.
 */
export default function ConfirmModal({
  open, title, message, confirmLabel = "Confirmer", danger = false, busy = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; message?: string; confirmLabel?: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const idTitre = useId();
  const idMessage = useId();
  const boite = usePiegeFocus<HTMLDivElement>(open, busy ? undefined : onCancel);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        ref={boite}
        // `aria-labelledby` plutôt que `aria-label` : le titre est déjà à l'écran, le dupliquer
        // dans un attribut le ferait diverger le jour où l'un des deux change.
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        aria-describedby={message ? idMessage : undefined}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={idTitre} className="text-lg font-semibold">{title}</h2>
        {message && <p id={idMessage} className="mt-2 text-sm text-gray-600">{message}</p>}
        <div className="mt-5 flex gap-2">
          <Button data-focus-initial variant="secondary" className="flex-1" onClick={onCancel} disabled={busy}>Annuler</Button>
          <Button variant={danger ? "danger" : "primary"} className="flex-1" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
