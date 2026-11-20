import Link from "next/link";
import Wordmark from "@/components/Wordmark";

/**
 * En-tête et pied de page communs aux pages de la vitrine.
 *
 * Factorisés parce que la vitrine porte maintenant quatre pages : un lien de navigation ajouté à
 * un seul endroit crée une page orpheline, et une page orpheline ne construit aucune autorité
 * thématique. Le maillage interne du pied de page est ici le vrai sujet, pas le style.
 */

const LIENS_NAV = [
  { href: "/logiciel-renovation-jantes", texte: "Rénovation de jantes" },
  { href: "/logiciel-sous-traitance-thermolaquage", texte: "Sous-traitance" },
  { href: "/prix-logiciel-thermolaquage", texte: "Tarifs" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tpblue">
          <Wordmark dark className="text-lg" />
          <span className="sr-only">Thermogestion — accueil</span>
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-4 text-sm sm:gap-5">
          {LIENS_NAV.map((l) => (
            // Reliquat vague 3 — ces liens n'avaient aucun indicateur de focus clavier, contrairement
            // au logo et au bouton « Essai gratuit » du même en-tête. `outline-tpblue`, pas
            // `outline-brand` : c'est la couleur de focus déjà posée sur le logo juste au-dessus,
            // choisie pour rester visible sur ce fond sombre.
            <Link key={l.href} href={l.href} className="hidden rounded text-zinc-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tpblue lg:block">
              {l.texte}
            </Link>
          ))}
          {/* Lien natif et non <Link> : /demo est une route serveur qui pose la session de
              démonstration, le routeur client de Next la court-circuiterait. */}
          <a href="/demo" className="rounded text-zinc-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tpblue">Démo</a>
          <Link href="/login" className="hidden rounded text-zinc-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tpblue sm:block">Connexion</Link>
          <Link
            href="/signup"
            className="rounded-lg bg-tpblue px-4 py-2 font-semibold text-ink transition hover:bg-tpblue-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Essai gratuit
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-ink-line bg-ink py-12 text-sm text-zinc-400">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3">
        <div>
          <Wordmark dark className="text-lg" />
          <p className="mt-3 leading-relaxed">
            Le logiciel des ateliers de thermolaquage et de rénovation de jantes.
          </p>
          <p className="mt-3">
            Édité par la <b className="font-medium text-zinc-300">SASU Royal Motorbike</b> (Thermopoudre),
            distributeur de matériel et de poudres de thermolaquage, Bandol (83).
          </p>
        </div>
        <nav aria-label="Le produit">
          <h2 className="font-display text-xs font-semibold uppercase tracking-kicker text-zinc-300">Le produit</h2>
          <ul className="mt-3 space-y-2">
            <li><Link href="/logiciel-renovation-jantes" className="transition hover:text-white">Logiciel de rénovation de jantes</Link></li>
            <li><Link href="/logiciel-sous-traitance-thermolaquage" className="transition hover:text-white">Logiciel de sous-traitance thermolaquage</Link></li>
            <li><Link href="/prix-logiciel-thermolaquage" className="transition hover:text-white">Prix et comparatif</Link></li>
            <li><a href="/demo" className="transition hover:text-white">Atelier de démonstration</a></li>
            <li><Link href="/aide-publique" className="transition hover:text-white">Centre d&apos;aide</Link></li>
            <li><Link href="/signup" className="transition hover:text-white">Essai gratuit 30 jours</Link></li>
          </ul>
        </nav>
        <nav aria-label="Informations légales">
          <h2 className="font-display text-xs font-semibold uppercase tracking-kicker text-zinc-300">Informations</h2>
          <ul className="mt-3 space-y-2">
            <li><a href="mailto:contact@thermopoudre.fr" className="transition hover:text-white">contact@thermopoudre.fr</a></li>
            <li><a href="https://thermopoudre.fr" className="transition hover:text-white">thermopoudre.fr — poudres et matériel</a></li>
            <li><Link href="/legal/mentions" className="transition hover:text-white">Mentions légales</Link></li>
            <li><Link href="/legal/cgu" className="transition hover:text-white">CGU / CGV</Link></li>
            <li><Link href="/legal/confidentialite" className="transition hover:text-white">Confidentialité</Link></li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl px-4 text-xs text-zinc-400">
        Données hébergées en Europe (Supabase, eu-west-3), isolées par atelier, exportables à tout moment.
      </p>
    </footer>
  );
}
