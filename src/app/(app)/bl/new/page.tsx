import BonLivraisonEditor from "@/components/BonLivraisonEditor";
import { PageTitle } from "@/components/ui";

export default async function NewBlPage({ searchParams }: { searchParams: Promise<{ projet?: string }> }) {
  const { projet } = await searchParams;
  return (
    <div className="md:max-w-2xl">
      <PageTitle>Nouveau bon de livraison</PageTitle>
      <BonLivraisonEditor projetInitial={projet} />
    </div>
  );
}
