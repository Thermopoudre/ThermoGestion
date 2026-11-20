import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import BlocageAbonnement from "@/components/BlocageAbonnement";
import BandeauDemo from "@/components/BandeauDemo";
import TrackDemo from "@/components/TrackDemo";
import { HelpCircle, Settings } from "lucide-react";
import Wordmark from "@/components/Wordmark";
import { PlanProvider } from "@/components/PlanProvider";
import { AlertesProvider } from "@/components/AlertesProvider";
import { accesOuvert, joursRestantsEssai, type Abonnement } from "@/lib/abonnement";
import { estRole } from "@/lib/roles";
import type { ReglagesAlertes } from "@/lib/alertes";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membre } = await supabase.from("users").select("id, atelier_id, role").maybeSingle();
  if (!membre) redirect("/onboarding");

  // Le cabinet n'entre pas dans l'atelier. Sans cette sortie, il traverserait la coquille prévue
  // pour un laqueur — barre de production, bandeau d'essai, blocage d'abonnement — devant des
  // écrans que la RLS lui rend systématiquement vides : un produit qui a l'air en panne dès la
  // première minute. Une redirection au niveau du gabarit couvre toutes les pages de `(app)`
  // d'un seul endroit, y compris celles qu'on ajoutera demain sans y penser.
  if (membre.role === "comptable") redirect("/comptable");

  const [{ data: sub }, { data: atelier }, { count: nbJeuxJantes }, { data: alertes }] = await Promise.all([
    // `sieges_supp` fait partie du contexte de plan : sans lui, `siegesAutorises()` retomberait
    // silencieusement sur les seuls sièges compris dans la formule, et les écrans annonceraient
    // moins de places que la base n'en accorde réellement.
    //
    // La lecture passe par `mon_abonnement()` et non par la table : `subscriptions` n'est plus
    // ouverte qu'au responsable. Sans cette RPC, le bureau et l'atelier verraient `null`, donc un
    // abonnement absent, donc une application figée en lecture seule — un verrou de rôle qui
    // casse le produit au lieu de le protéger.
    supabase.rpc("mon_abonnement"),
    supabase.from("ateliers").select("nom, demo, settings").maybeSingle(),
    // Un atelier qui rénove des jantes a la rubrique en écran principal, pas derrière « Plus ».
    // Déduit de la donnée : aucun réglage à cocher, et la barre s'adapte au premier jeu créé.
    supabase.from("jeux_jantes").select("id", { count: "exact", head: true }),
    // Les réglages d'alerte : le seuil de DLU (lu par six écrans) et la cadence des relances (lue
    // par les fiches devis et facture). Chargés ici une fois plutôt que six, et par la RPC plutôt
    // que par la table — elle sait retomber sur les défauts si la ligne n'existe pas encore.
    supabase.rpc("mes_reglages_alertes"),
  ]);

  const abonnement = (sub ?? null) as Abonnement | null;
  const ouvert = accesOuvert(abonnement);
  const joursRestants = joursRestantsEssai(abonnement);
  // Le métier choisi à l'inscription commande la barre de navigation, pas seulement les données :
  // un atelier de jantes tout neuf n'a encore aucun jeu à compter.
  const metier = (atelier?.settings as { metier?: string } | null)?.metier;
  const orienteJantes = metier === "jantes" || metier === "mixte" || (nbJeuxJantes ?? 0) > 0;

  return (
    <PlanProvider sub={abonnement} role={estRole(membre.role) ? membre.role : null}>
      <AlertesProvider reglages={(alertes as ReglagesAlertes | null) ?? null}>
      <div className="min-h-screen bg-gray-50 md:flex">
        {/* Navigation latérale persistante sur bureau (≥ md) : la barre basse mobile reste
            pensée pour l'atelier (gants, une main), le bureau a la place pour tout afficher. */}
        <Sidebar atelierNom={atelier?.nom ?? ""} />

        <div className="flex min-h-screen flex-1 flex-col md:min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
            <Link href="/dashboard" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><Wordmark /></Link>
            <div className="flex items-center gap-1">
              <Link href="/aide" aria-label="Aide" className="rounded p-1 text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><HelpCircle size={22} aria-hidden /></Link>
              <Link href="/reglages" aria-label="Réglages" className="rounded p-1 text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><Settings size={22} aria-hidden /></Link>
            </div>
          </header>

          {atelier?.demo && <BandeauDemo />}
          {atelier?.demo && <TrackDemo />}

          {/* L'atelier de démonstration n'a pas d'essai à décompter : le bandeau commercial
              n'aurait aucun sens pour un visiteur qui n'a pas de compte. */}
          {!atelier?.demo && joursRestants !== null && ouvert && (
            <Link href="/abonnement" className={`block px-4 py-1.5 text-center text-xs font-medium ${joursRestants <= 7 ? "bg-warning-light text-warning-dark" : "bg-brand-light text-brand-dark"}`}>
              {joursRestants <= 7
                ? `Votre essai se termine dans ${joursRestants} jour${joursRestants > 1 ? "s" : ""} — choisissez votre formule pour continuer à travailler →`
                : `Essai gratuit : ${joursRestants} jours restants · Choisir ma formule →`}
            </Link>
          )}
          {!atelier?.demo && !ouvert && (
            <Link href="/abonnement" className="block bg-red-600 px-4 py-1.5 text-center text-xs font-medium text-white">
              Essai terminé — atelier en lecture seule · Réactiver →
            </Link>
          )}

          {/* Le contenu reste visible mais inerte : l'atelier voit ses données, sans pouvoir les modifier.
              Largeur progressive : confortable en mobile (max-w-3xl), s'élargit sur grand écran jusqu'à 1280px
              pour ne plus laisser un immense vide autour d'une app pensée mobile-first à l'origine. */}
          <main className={`mx-auto w-full max-w-3xl flex-1 p-4 pb-24 md:max-w-5xl md:px-8 md:py-6 md:pb-10 xl:max-w-[1280px] ${ouvert ? "" : "pointer-events-none select-none opacity-50"}`}>
            {children}
          </main>
          {!ouvert && <BlocageAbonnement />}
          <BottomNav jantes={orienteJantes} />
        </div>
      </div>
      </AlertesProvider>
    </PlanProvider>
  );
}
