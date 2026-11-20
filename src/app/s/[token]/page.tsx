import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PublicNotFound from "@/components/PublicNotFound";
import SuiviPublicClient from "@/components/SuiviPublicClient";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("projet_public", { p_token: token });
  if (!data) return { title: "Suivi introuvable", description: "Ce lien n'est plus valide ou a expiré." };
  const title = `Suivi ${data.numero ?? ""} — ${data.atelier?.nom ?? "Thermogestion"}`;
  const description = `Suivez en temps réel l'avancement de vos pièces chez ${data.atelier?.nom ?? "l'atelier"}.`;
  return { title, description, openGraph: { title, description } };
}

export default async function SuiviPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("projet_public", { p_token: token });

  if (!data) {
    return <PublicNotFound title="Suivi introuvable" message="Ce suivi n'existe pas ou n'est plus disponible." />;
  }

  // Le rendu passe côté client pour la bascule de langue : c'est un écran que le client final
  // ouvre depuis son téléphone, souvent dans une autre langue que celle de l'atelier.
  return <SuiviPublicClient data={data} />;
}
