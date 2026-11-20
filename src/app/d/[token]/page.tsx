import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PublicNotFound from "@/components/PublicNotFound";
import DevisPublicClient from "@/components/DevisPublicClient";
import { eur } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("devis_public", { p_token: token });
  if (!data) return { title: "Devis introuvable", description: "Ce lien n'est plus valide ou a expiré." };
  const title = `Devis ${data.numero ?? ""} — ${data.atelier?.nom ?? "Thermogestion"}`;
  const description = `Devis de ${data.atelier?.nom ?? "l'atelier"} pour un montant de ${eur(data.total_ttc)} TTC. Consultez le détail et signez en ligne.`;
  return { title, description, openGraph: { title, description } };
}

export default async function DevisPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("devis_public", { p_token: token });

  if (!data) {
    return <PublicNotFound title="Devis introuvable" message="Ce devis n'existe pas ou n'est plus disponible." />;
  }
  return <DevisPublicClient devis={data} token={token} />;
}
