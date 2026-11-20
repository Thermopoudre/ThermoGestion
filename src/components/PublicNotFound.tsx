import { Unlink } from "lucide-react";

type Props = {
  title: string;
  message: string;
};

/**
 * État "lien invalide ou expiré", partagé par les 5 pages publiques (devis, suivi,
 * facture, bon de livraison, réception). Avant, chaque page affichait un texte brut
 * différent : ce composant harmonise le ton et ajoute une piste de résolution pour
 * le client qui atterrit ici depuis un lien SMS/e-mail cassé ou périmé.
 */
export default function PublicNotFound({ title, message }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"
        >
          <Unlink size={22} />
        </div>
        <h1 className="font-display text-lg font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <p className="mt-4 text-xs text-gray-500">
          Vérifiez le lien reçu par SMS ou e-mail, ou contactez directement l&apos;atelier qui vous
          l&apos;a transmis.
        </p>
      </div>
    </main>
  );
}
