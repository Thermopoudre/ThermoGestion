"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Paintbrush, FileText, Receipt, MoreHorizontal, Users, PackageCheck, Truck, FlaskConical, Layers, Settings, X, Flame, ShieldCheck, ShoppingCart, TrendingUp, CircleDot, HelpCircle, Search, Timer, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import RechercheGlobale, { BoutonRecherche } from "./RechercheGlobale";
import { usePiegeFocus } from "./usePiegeFocus";
import { PastilleVerrou } from "./VerrouPlan";
import { usePlan } from "./PlanProvider";
import { refusDeRole } from "@/lib/roles";
import type { Capacite } from "@/lib/abonnement";

// 4 entrées essentielles à l'atelier (usage tactile, mains parfois sales) + un accès "Plus"
// qui regroupe le reste dans un panneau. Le tout est masqué sur bureau (voir Sidebar).
//
// Comme dans la barre latérale : une rubrique fermée par la **formule** reste visible avec sa
// pastille (c'est un argument commercial), une rubrique fermée par le **rôle** disparaît. Un
// opérateur n'achètera jamais l'accès aux devis, il ne peut que le subir.
type Entree = { href: string; label: string; Icon: typeof Home; capacite?: Capacite };

const ACCUEIL: Entree = { href: "/dashboard", label: "Accueil", Icon: Home };
const PROJETS: Entree = { href: "/projets", label: "Projets", Icon: Paintbrush };
const DEVIS: Entree = { href: "/devis", label: "Devis", Icon: FileText };
const FACTURES: Entree = { href: "/factures", label: "Factures", Icon: Receipt };
const JANTES: Entree = { href: "/jantes", label: "Jantes", Icon: CircleDot };
const POINTAGE: Entree = { href: "/pointage", label: "Pointage", Icon: Timer };
const RECEPTIONS: Entree = { href: "/receptions", label: "Réceptions", Icon: PackageCheck };

const plusItems: Entree[] = [
  { href: "/clients", label: "Clients", Icon: Users },
  // Amélioration n°1 (07/09/2026) — réception des factures fournisseurs. Même périmètre de rôle
  // que `/comptable` : `refusDeRole` la filtre déjà pour l'opérateur.
  { href: "/factures-recues", label: "Factures reçues", Icon: Inbox },
  { href: "/fournees", label: "Fournées", Icon: Flame, capacite: "fournees" },
  RECEPTIONS,
  // Le pointage n'était atteignable que depuis la liste des projets : un écran facturé 5 € HT
  // par mois et par siège, sans aucune entrée dans la navigation.
  POINTAGE,
  { href: "/bl", label: "Bons de livraison", Icon: Truck },
  { href: "/stock", label: "Stock", Icon: FlaskConical },
  { href: "/lots", label: "Lots de poudre", Icon: Layers },
  { href: "/commandes", label: "Commandes", Icon: ShoppingCart, capacite: "commande_poudre" },
  { href: "/qualite", label: "Qualité", Icon: ShieldCheck, capacite: "qualite" },
  { href: "/pilotage", label: "Pilotage", Icon: TrendingUp, capacite: "rentabilite" },
  { href: "/aide", label: "Aide", Icon: HelpCircle },
  { href: "/reglages", label: "Réglages", Icon: Settings },
];

export default function BottomNav({ jantes = false }: { jantes?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { role, commercial } = usePlan();
  // Le panneau « Plus » est une modale : Échap le ferme, Tab y reste, et le focus retourne au
  // bouton « Plus » à la fermeture — sinon on repart en haut de page, treize tabulations plus loin.
  const panneau = usePiegeFocus<HTMLDivElement>(open, () => setOpen(false));

  // Un atelier qui rénove des jantes travaille dans « Jantes » toute la journée et facture le
  // vendredi soir, au bureau : c'est Factures qui passe dans « Plus », pas l'inverse.
  //
  // L'opérateur, lui, n'a pas quatre boutons dont deux ferment la porte : filtrer la barre
  // commerciale lui laisserait Accueil et Projets, et deux trous. Sa barre est refaite pour son
  // métier — sa journée, dans l'ordre : il arrive, il pointe, il reçoit des pièces, il les fait
  // avancer.
  const barreAtelier = [ACCUEIL, PROJETS, POINTAGE, RECEPTIONS];
  const items = commercial
    ? (jantes ? [ACCUEIL, PROJETS, JANTES, DEVIS] : [ACCUEIL, PROJETS, DEVIS, FACTURES])
    : (jantes ? [ACCUEIL, JANTES, POINTAGE, RECEPTIONS] : barreAtelier);

  const resteBrut = commercial
    ? (jantes ? [FACTURES, ...plusItems] : [JANTES, ...plusItems])
    : (jantes ? [PROJETS, ...plusItems] : [JANTES, ...plusItems]);
  // Deux filtres : le rôle retire les rubriques fermées, et on écarte ce qui est déjà dans la
  // barre — un doublon dans le panneau « Plus » n'aide personne à s'y retrouver.
  const reste = resteBrut.filter(
    (i) => refusDeRole(i.href, role) === null && !items.some((b) => b.href === i.href),
  );
  const plusActive = reste.some((i) => path.startsWith(i.href));

  return (
    <>
      {/* La palette de recherche est montée ici, et une seule fois : ce composant est rendu sur
          tous les formats (seule sa barre est masquée sur bureau), alors que la barre latérale,
          elle, est en `display:none` sur mobile — un panneau posé à l'intérieur y serait invisible
          au doigt, c'est-à-dire là où on en a le plus besoin. */}
      <RechercheGlobale />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navigation principale">
        <div className="mx-auto flex max-w-3xl">
          {/* La loupe en premier, du côté du pouce : l'atelier cherche un dossier bien plus
              souvent qu'il ne revient à l'accueil. */}
          <BoutonRecherche
            label="Rechercher dans tout l'atelier"
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-2xs text-gray-500"
          >
            <>
              <Search size={20} aria-hidden />
              Rechercher
            </>
          </BoutonRecherche>
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                path.startsWith(href) ? "font-semibold text-brand" : "text-gray-500"
              )}
            >
              <Icon size={20} aria-hidden />
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
              plusActive ? "font-semibold text-brand" : "text-gray-500"
            )}
          >
            <MoreHorizontal size={20} aria-hidden />
            Plus
          </button>
        </div>
      </nav>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Plus de rubriques"
          onClick={() => setOpen(false)}
        >
          <div
            ref={panneau}
            className="w-full rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300" />
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-sm font-semibold text-gray-700">Plus</span>
              <button
                type="button"
                data-focus-initial
                aria-label="Fermer"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 px-3 pb-2">
              {reste.map(({ href, label, Icon, capacite }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "relative flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-center text-2xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                    path.startsWith(href) ? "bg-brand-light text-brand-dark" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Icon size={20} aria-hidden />
                  {label}
                  {capacite && <PastilleVerrou capacite={capacite} className="absolute right-1 top-1" />}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
