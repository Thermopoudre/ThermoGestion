import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/env";
import PublicNotFound from "@/components/PublicNotFound";
import JeuJantesPublicClient, { type PublicJeuJantes } from "@/components/JeuJantesPublicClient";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("jeu_jantes_public", { p_token: token });
  if (!data) return { title: "Bon de prise en charge introuvable", description: "Ce lien n'est plus valide ou a expiré." };
  const title = `Prise en charge ${data.numero ?? ""} — ${data.atelier?.nom ?? "Thermogestion"}`;
  return {
    title,
    description: `État constaté jante par jante, photos à l'appui, du jeu déposé chez ${data.atelier?.nom ?? "l'atelier"}.`,
    openGraph: { title },
  };
}

export default async function JeuJantesPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("jeu_jantes_public", { p_token: token });

  if (!data) {
    return <PublicNotFound title="Bon de prise en charge introuvable" message="Ce bon n'existe pas ou n'est plus disponible." />;
  }

  const jeu = data as PublicJeuJantes;

  // Bucket privé : le porteur du lien n'a pas de session, les URL sont signées côté serveur. Sans
  // clé service role, le bon reste lisible — mais sans les photos, qui sont pourtant l'essentiel
  // du document : la page le dit alors explicitement au lieu d'afficher un vide trompeur.
  const chemins = [
    ...(jeu.photos ?? []),
    ...(jeu.jantes ?? []).flatMap((r) => r.photos ?? []),
  ];
  const signees = new Map<string, string>();
  if (chemins.length > 0 && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = createServiceClient();
      const { data: urls } = await service.storage.from("photos").createSignedUrls(chemins, 3600);
      (urls ?? []).forEach((u) => { if (u.path && u.signedUrl) signees.set(u.path, u.signedUrl); });
    } catch {
      /* le bon reste lisible sans ses photos */
    }
  }

  return <JeuJantesPublicClient jeu={jeu} token={token} urls={Object.fromEntries(signees)} photosIndisponibles={chemins.length > 0 && signees.size === 0} />;
}
