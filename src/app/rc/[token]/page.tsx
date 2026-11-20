import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/env";
import PublicNotFound from "@/components/PublicNotFound";
import ReceptionPublicClient from "@/components/ReceptionPublicClient";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("reception_public", { p_token: token });
  if (!data) return { title: "Bon de réception introuvable", description: "Ce lien n'est plus valide ou a expiré." };
  const title = `Bon de réception ${data.numero ?? ""} — ${data.atelier?.nom ?? "Thermogestion"}`;
  const description = `Accusé de réception des pièces déposées chez ${data.atelier?.nom ?? "l'atelier"} — état constaté et photos.`;
  return { title, description, openGraph: { title, description } };
}

export default async function ReceptionPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("reception_public", { p_token: token });

  if (!data) {
    return <PublicNotFound title="Bon de réception introuvable" message="Ce bon de réception n'existe pas ou n'est plus disponible." />;
  }

  // Le bucket photos est privé : le porteur du lien n'a pas de session, on signe donc les URL
  // côté serveur. Sans clé service role configurée, le bon reste lisible, simplement sans photos.
  const chemins: string[] = Array.isArray(data.photos) ? data.photos : [];
  let photos: string[] = [];
  if (chemins.length > 0 && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = createServiceClient();
      const { data: signees } = await service.storage.from("photos").createSignedUrls(chemins, 3600);
      photos = (signees ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u);
    } catch {
      photos = [];
    }
  }

  return <ReceptionPublicClient reception={data} photos={photos} />;
}
