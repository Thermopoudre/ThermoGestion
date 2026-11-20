import FactureEditor from "@/components/FactureEditor";
import { PageTitle } from "@/components/ui";

export default async function NewFacturePage({ searchParams }: { searchParams: Promise<{ devis?: string }> }) {
  const { devis } = await searchParams;
  return (
    // Pas de `md:max-w-2xl` : la coquille s'ouvre à 1280 px et la facturation se fait au bureau,
    // sur grand écran. La colonne de 672 px empilait 6 champs sur 3 rangées pour rien.
    <div>
      <PageTitle>Nouvelle facture</PageTitle>
      <FactureEditor devisInitial={devis} />
    </div>
  );
}
