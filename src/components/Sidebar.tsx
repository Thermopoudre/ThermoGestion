"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Paintbrush, FileText, Receipt, Users, FlaskConical, PackageCheck, Truck, Layers, Settings, Flame, ShieldCheck, ShoppingCart, TrendingUp, CircleDot, HelpCircle, Search, Timer, Calculator, Send, Trash2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoutonRecherche } from "./RechercheGlobale";
import Wordmark from "./Wordmark";
import { PastilleVerrou } from "./VerrouPlan";
import { usePlan } from "./PlanProvider";
import { refusDeRole } from "@/lib/roles";
import type { Capacite } from "@/lib/abonnement";

// Toutes les rubriques, dans l'ordre métier (du devis à la facture), pour la navigation
// latérale persistante affichée sur bureau uniquement.
//
// **Deux verrous, deux traitements opposés, et ce n'est pas une incohérence.**
//
// Une rubrique fermée par la *formule* reste visible et cliquable, avec la formule qui l'ouvre
// écrite à côté. La masquer serait plus propre à l'œil et catastrophique commercialement : un
// exploitant qui ne voit pas le registre de contrôles ne peut pas avoir envie de le payer, et il
// découvrirait à la démonstration suivante que le produit savait le faire depuis six mois.
//
// Une rubrique fermée par le *rôle* est retirée, sans pastille ni explication. L'opérateur ne
// l'achètera jamais — il ne peut que la subir — et lui laisser quatre entrées qui mènent
// systématiquement à « accès réservé » ne vend rien à personne : ça use.
const items: { href: string; label: string; Icon: typeof Home; capacite?: Capacite }[] = [
  { href: "/dashboard", label: "Accueil", Icon: Home },
  { href: "/devis", label: "Devis", Icon: FileText },
  { href: "/projets", label: "Projets", Icon: Paintbrush },
  // Le pointage n'avait aucune entrée de navigation : on n'y arrivait que par un bouton de la
  // liste des projets. C'est pourtant l'écran de la journée d'un opérateur — celui pour lequel
  // son siège est facturé.
  { href: "/pointage", label: "Pointage", Icon: Timer },
  { href: "/jantes", label: "Jantes", Icon: CircleDot },
  { href: "/fournees", label: "Fournées", Icon: Flame, capacite: "fournees" },
  { href: "/receptions", label: "Réceptions", Icon: PackageCheck },
  { href: "/bl", label: "Bons de livraison", Icon: Truck },
  { href: "/factures", label: "Factures", Icon: Receipt },
  // Amélioration n°1 (07/09/2026) — réception des factures fournisseurs, obligatoire depuis le
  // 01/09/2026. Rôle fermé comme `/comptable` (`PREFIXES_COMPTABLES`) : bureau, responsable, et
  // le cabinet comptable en lecture ; fermé à l'opérateur.
  { href: "/factures-recues", label: "Factures reçues", Icon: Inbox },
  { href: "/clients", label: "Clients", Icon: Users },
  { href: "/stock", label: "Stock", Icon: FlaskConical },
  { href: "/lots", label: "Lots de poudre", Icon: Layers },
  { href: "/commandes", label: "Commandes poudre", Icon: ShoppingCart, capacite: "commande_poudre" },
  { href: "/qualite", label: "Qualité", Icon: ShieldCheck, capacite: "qualite" },
  { href: "/pilotage", label: "Pilotage", Icon: TrendingUp, capacite: "rentabilite" },
  // L'entrée est visible même sans cabinet invité : c'est là qu'on découvre que l'accès existe,
  // et l'atelier qui ne le découvre pas continue d'envoyer ses exports par courriel.
  { href: "/comptable", label: "Expert-comptable", Icon: Calculator },
  // Ces deux écrans existaient sans porte d'entrée. Une relance part au nom de l'atelier, à ses
  // clients : il doit pouvoir lire ce qui a été envoyé sans qu'on lui donne une adresse. Et une
  // corbeille qu'on ne trouve pas ne rassure personne sur ce que devient un document jeté.
  { href: "/relances", label: "Relances envoyées", Icon: Send },
  { href: "/corbeille", label: "Corbeille", Icon: Trash2 },
  { href: "/aide", label: "Aide", Icon: HelpCircle },
  { href: "/reglages", label: "Réglages", Icon: Settings },
];

export default function Sidebar({ atelierNom }: { atelierNom: string }) {
  const path = usePathname();
  const { role } = usePlan();
  // `refusDeRole` est la même fonction que celle appliquée à l'ouverture d'un écran et que celle
  // rejouée en RLS : la barre ne peut donc pas proposer ce que la base refusera, ni cacher ce
  // qu'elle accorde. Une liste de rubriques recopiée ici aurait divergé au premier ajout.
  const visibles = items.filter((i) => refusDeRole(i.href, role) === null);
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="border-b border-gray-100 px-5 py-5">
        <Link href="/dashboard" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          <Wordmark />
        </Link>
        {atelierNom && <div className="mt-1 truncate text-xs font-medium text-gray-500">{atelierNom}</div>}
      </div>
      {/* La recherche est la première chose de la barre, avant les rubriques : au téléphone comme
          au clavier, c'est le point d'entrée le plus fréquent d'une journée d'atelier. Le raccourci
          est écrit à côté — un raccourci qu'on ne peut pas découvrir n'existe pas. */}
      <div className="px-3 pt-3">
        <BoutonRecherche className="flex w-full min-h-[44px] items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 transition duration-150 ease-out hover:bg-gray-50">
          <Search size={18} aria-hidden />
          <span className="flex-1 text-left">Rechercher…</span>
          <kbd className="rounded border border-gray-300 px-1.5 py-0.5 text-2xs text-gray-400">Ctrl K</kbd>
        </BoutonRecherche>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {visibles.map(({ href, label, Icon, capacite }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg min-h-[44px] px-3 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                active ? "bg-brand-light text-brand-dark" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Icon size={18} aria-hidden />
              <span className="flex-1">{label}</span>
              {capacite && <PastilleVerrou capacite={capacite} />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
