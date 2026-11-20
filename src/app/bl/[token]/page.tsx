import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PublicNotFound from "@/components/PublicNotFound";
import BLPublicClient from "@/components/BLPublicClient";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("bl_public", { p_token: token });
  if (!data) return { title: "Bon de livraison introuvable", description: "Ce lien n'est plus valide ou a expiré." };
  const title = `Bon de livraison ${data.numero ?? ""} — ${data.atelier?.nom ?? "Thermogestion"}`;
  const description = `Bon de livraison de ${data.atelier?.nom ?? "l'atelier"}. Vérifiez vos pièces et confirmez la réception en ligne.`;
  return { title, description, openGraph: { title, description } };
}

export default async function BLPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("bl_public", { p_token: token });

  if (!data) {
    return <PublicNotFound title="Bon de livraison introuvable" message="Ce bon de livraison n'existe pas ou n'est plus disponible." />;
  }
  return <BLPublicClient bl={data} token={token} />;
}
