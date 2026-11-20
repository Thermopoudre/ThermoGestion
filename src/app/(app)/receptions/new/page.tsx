import Link from "next/link";
import ReceptionForm from "@/components/ReceptionForm";
import { PageTitle } from "@/components/ui";

export default function NewReceptionPage() {
  return (
    <div className="md:max-w-2xl">
      <PageTitle>Réception de pièces</PageTitle>
      <p className="mb-4 text-sm text-gray-600">
        Enregistrez ce que vous recevez, puis photographiez les pièces à l&apos;étape suivante. Sans
        photo horodatée, un litige sur une rayure se règle toujours en votre défaveur.
      </p>
      {/* Amélioration n°10 (07/09/2026) — aiguillage explicite plutôt qu'une fusion des deux
          circuits : un jeu de jantes a son propre dossier (photos roue par roue, bon de prise en
          charge), et arriver ici pour lui reviendrait à perdre ce détail. Affiché sur le bouton de
          création lui-même, avant que la saisie ne commence. */}
      <p className="mb-4 rounded-lg border border-brand/25 bg-brand-light/40 p-3 text-sm text-brand-dark">
        Ce dépôt concerne un jeu de jantes ?{" "}
        <Link href="/jantes/new" className="font-medium underline">
          Ouvrir le dossier jantes
        </Link>{" "}
        plutôt : photos roue par roue et bon de prise en charge signé, au lieu d&apos;une réception
        générique.
      </p>
      <ReceptionForm />
    </div>
  );
}
