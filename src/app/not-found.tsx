"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, Home, LayoutDashboard, LifeBuoy, LogIn, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import RechercheGlobale, { ouvrirRecherche } from "@/components/RechercheGlobale";
import Wordmark from "@/components/Wordmark";

/**
 * Page introuvable — celle qui répond à toutes les adresses qui n'existent pas.
 *
 * POURQUOI ce fichier existe. Sans lui, Next.js sert sa page par défaut : fond noir, « This page
 * could not be found. », aucun lien. Un laqueur qui tape `/reglages/equipe` à la main, ou qui
 * suit un vieux marque-page, tombait sur un écran anglais dont on ne sort qu'avec le bouton
 * « précédent » du navigateur — s'il pense à s'en servir. Sur un téléphone, en atelier, c'est un
 * cul-de-sac.
 *
 * DEUX PUBLICS, DEUX SORTIES. Cette page répond aussi bien à un prospect égaré sur la vitrine
 * qu'à un exploitant connecté qui s'est trompé d'adresse. Leur proposer les mêmes liens
 * enverrait forcément l'un des deux au mauvais endroit : on regarde donc s'il y a une session
 * ouverte, et on propose le tableau de bord et la recherche aux uns, l'accueil et la connexion
 * aux autres.
 *
 * POURQUOI la recherche est ici. Neuf fois sur dix, celui qui atterrit sur une adresse morte
 * cherchait une pièce précise — un devis, un client, une plaque. Le renvoyer au tableau de bord
 * lui fait recommencer sa navigation ; lui ouvrir la palette de recherche le remet exactement où
 * il allait. `RechercheGlobale` est monté ici parce que la barre de navigation, elle, n'est pas
 * rendue sur cette page : elle vit dans le gabarit `(app)`, que les adresses inconnues
 * n'atteignent jamais.
 */
export default function PageIntrouvable() {
  // `undefined` = on ne sait pas encore. On n'affiche aucune des deux sorties tant que la
  // question n'est pas tranchée : proposer « Se connecter » à quelqu'un qui l'est déjà, même
  // pendant une demi-seconde, donne le sentiment d'avoir été déconnecté.
  const [connecte, setConnecte] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let vivant = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => { if (vivant) setConnecte(!!data.user); })
      .catch(() => { if (vivant) setConnecte(false); });
    return () => { vivant = false; };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-5 flex justify-center">
          <Wordmark />
        </div>

        <div
          aria-hidden
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand"
        >
          <Compass size={24} />
        </div>

        <h1 className="font-display text-lg font-bold text-gray-900">Cette page n&apos;existe pas</h1>
        <p className="mt-2 text-sm text-gray-600">
          L&apos;adresse demandée ne correspond à aucun écran de Thermogestion. Elle a peut-être
          changé de nom, ou la pièce que vous cherchiez a été supprimée. Rien n&apos;est cassé de
          votre côté.
        </p>

        {connecte === undefined ? (
          // Réserve de la place pour éviter que la carte saute quand les boutons arrivent.
          <div className="mt-6 h-24" aria-hidden />
        ) : connecte ? (
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={ouvrirRecherche}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand min-h-[44px] px-4 py-3 text-sm font-medium text-white transition duration-150 ease-out hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Search size={16} aria-hidden /> Rechercher un client, un devis, une facture
            </button>
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800 transition duration-150 ease-out hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <LayoutDashboard size={16} aria-hidden /> Revenir au tableau de bord
            </Link>
            <Link
              href="/aide"
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <LifeBuoy size={16} aria-hidden /> Ouvrir le centre d&apos;aide
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-lg bg-brand min-h-[44px] px-4 py-3 text-sm font-medium text-white transition duration-150 ease-out hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Home size={16} aria-hidden /> Revenir à l&apos;accueil
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800 transition duration-150 ease-out hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <LogIn size={16} aria-hidden /> Me connecter à mon atelier
            </Link>
          </div>
        )}

        <p className="mt-5 text-xs text-gray-500">
          Si vous êtes arrivé ici depuis un lien reçu par e-mail ou par SMS, vérifiez qu&apos;il a
          bien été copié en entier — les liens de devis et de bons de livraison sont longs et se
          coupent facilement.
        </p>
      </div>

      {/* La palette de recherche, montée ici faute de barre de navigation sur cette page. Elle ne
          rend rien tant qu'on ne l'ouvre pas. */}
      <RechercheGlobale />
    </main>
  );
}
