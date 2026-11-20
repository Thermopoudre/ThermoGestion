import ClientForm from "@/components/ClientForm";
import { PageTitle } from "@/components/ui";

export default function NewClientPage() {
  return (
    <div className="md:max-w-2xl">
      <PageTitle>Nouveau client</PageTitle>
      <ClientForm />
    </div>
  );
}
