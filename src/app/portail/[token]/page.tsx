import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PublicNotFound from "@/components/PublicNotFound";
import PortailPublicClient from "@/components/PortailPublicClient";
import type { EnTetePortail } from "@/lib/portail";

/**
 * L'espace client, à l'adresse `/portail/<jeton>`.
 *
 * Même mécanisme que les six pages à jeton existantes : une RPC `SECURITY DEFINER` exécutable par
 * `anon`, aucun compte, aucun cookie. Le middleware ne protège pas ce chemin — `/portail` n'est
 * pas dans `PREFIXES_PRIVES`, et il ne doit jamais y entrer : une page publique qui répond 307
 * vers `/login` est une page morte pour le client qui a reçu le lien.
 *
 * L'en-tête est rendu côté serveur pour que le nom de l'atelier s'affiche sans attendre, et parce
 * que c'est lui qui décide du 404. Les listes, elles, sont paginées côté client : un donneur
 * d'ordre avec trois ans d'historique ne doit pas télécharger trois ans d'historique.
 */

/**
 * Pas d'indexation.
 *
 * L'en-tête `X-Robots-Tag: noindex, nofollow, noarchive` est posé par `next.config.ts` sur
 * `/portail/:path*`, comme pour `/d/`, `/f/` et les autres. La déclaration `robots` ci-dessous
 * la double dans le HTML : deux mécanismes indépendants pour une page qui, si elle était
 * indexée, mettrait l'historique commercial d'une entreprise dans un moteur de recherche.
 *
 * Le titre ne contient **ni le nom du client ni celui de l'atelier** : c'est ce qui s'affiche dans
 * l'onglet du navigateur, dans l'historique et dans l'aperçu WhatsApp d'un lien transféré. Un
 * onglet « Espace de CARROSSIER DUPONT » lu par-dessus une épaule en dit déjà trop.
 */
export const metadata: Metadata = {
  title: "Votre espace client",
  description: "Suivez vos pièces et retrouvez vos documents.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PortailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("portail_client", { p_token: token });

  if (!data) {
    return (
      <PublicNotFound
        title="Espace client introuvable"
        message="Ce lien n'est plus valide : il a peut-être été renouvelé ou fermé par l'atelier."
      />
    );
  }

  return <PortailPublicClient entete={data as EnTetePortail} token={token} />;
}
