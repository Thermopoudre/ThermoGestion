import PoudreForm from "@/components/PoudreForm";
import { PageTitle } from "@/components/ui";

export default function NewPoudrePage() {
  return (
    <div className="md:max-w-2xl">
      <PageTitle>Nouvelle poudre</PageTitle>
      <PoudreForm />
    </div>
  );
}
