import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PublicNotFound from "@/components/PublicNotFound";
import FacturePublicClient from "@/components/FacturePublicClient";
import { dateFr, eur, factureARegler } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("facture_public", { p_token: token });
  if (!data) return { title: "Facture introuvable", description: "Ce lien n'est plus valide ou a expiré." };
  // L'onglet, l'aperçu WhatsApp et le partage doivent dire la même chose que le document : un avoir
  // annoncé « Facture … à régler » déclenche exactement l'appel client qu'on veut éviter.
  const annulee = data.status === "annulee";
  const aRegler = factureARegler(data);
  const nature = data.type === "avoir" ? "Avoir" : "Facture";
  const title = `${nature} ${data.numero ?? ""}${annulee ? " (annulée)" : ""} — ${data.atelier?.nom ?? "Thermogestion"}`;
  const description = annulee
    ? `${nature} annulée par ${data.atelier?.nom ?? "l'atelier"} — aucun règlement attendu.`
    : aRegler
      ? `Facture de ${data.atelier?.nom ?? "l'atelier"} — ${eur(data.total_ttc)} TTC${data.due_date ? ` à régler avant le ${dateFr(data.due_date)}` : ""}. Paiement en ligne sécurisé.`
      : `Avoir de ${data.atelier?.nom ?? "l'atelier"} — ${eur(data.total_ttc)} TTC en déduction de votre compte.`;
  return { title, description, openGraph: { title, description } };
}

export default async function FacturePublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("facture_public", { p_token: token });

  if (!data) {
    return <PublicNotFound title="Facture introuvable" message="Cette facture n'existe pas ou n'est plus disponible." />;
  }
  return <FacturePublicClient facture={data} />;
}
