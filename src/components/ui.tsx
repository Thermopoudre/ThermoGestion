"use client";
import { cn } from "@/lib/utils";
import { CLASSES_TON, type TonBadge } from "@/lib/tons";
import { ButtonHTMLAttributes, ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useRef, useState } from "react";

/**
 * Hauteur des cibles tactiles du produit.
 *
 * `md` (44 px) est le socle : `py-3` (12 px) + `text-sm` (interligne 20 px) = 44 px, soit
 * exactement le minimum de la règle 2.5.5 (Target Size) et la recommandation d'Apple comme de
 * Google. Le socle était à `py-2.5`, soit 40 px : une trentaine des 45 cibles trop petites de
 * l'audit ne venaient que de cette ligne. Quatre pixels, mais ils se prennent avec un gant.
 *
 * `xl` (56 px) est la taille des écrans d'atelier — « Démarrer », « Lancer la cuisson »,
 * « Émettre le BL » : `py-4` (16 px) + `text-base` (interligne 24 px). Elle existait déjà, mais
 * recopiée à la main en `className="py-4 text-base"` sur 14 boutons, donc hors du design system
 * et impossible à faire évoluer d'un geste.
 */
const TAILLES_BOUTON = {
  md: "px-4 py-3 text-sm",
  xl: "px-5 py-4 text-base",
} as const;

/**
 * `loading` plutôt que `disabled={busy}` avec un libellé réécrit : les écrans remplaçaient le
 * texte du bouton par « … », ou ne montraient rien du tout — sur la fiche projet, appuyer sur
 * « Valider » ne produisait aucun retour visuel. Le libellé est conservé (l'opérateur doit
 * toujours savoir sur quoi il a appuyé), le bouton devient inopérant et annonce son état aux
 * lecteurs d'écran.
 */
export function Button({ className, variant = "primary", taille = "md", loading = false, disabled, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; taille?: keyof typeof TAILLES_BOUTON; loading?: boolean }) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    secondary: "bg-white border border-gray-300 text-gray-800 hover:bg-gray-50",
    danger: "bg-danger text-white hover:bg-danger-dark",
    ghost: "text-brand hover:bg-brand-light",
  }[variant];
  return (
    <button
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn("relative rounded-lg font-medium transition duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand", TAILLES_BOUTON[taille], styles, className)}
      {...props}
    >
      {loading && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
      <span className={cn("contents", loading && "invisible")}>{children}</span>
    </button>
  );
}

// Style commun aux trois champs de saisie (`Input`, `Select`, `Textarea`), déclaré une fois.
//
// `py-3` et non `py-2.5` : 12 px + interligne 20 px = 44 px, la même hauteur que `Button`. Un
// formulaire dont les champs font 40 px et les boutons 44 se voit, et se rate au doigt.
//
// `focus:ring-1 focus:ring-brand` : `focus:outline-none` seul ne laissait qu'un changement de
// couleur de bordure — invisible sur une tablette d'atelier et au clavier (manquement WCAG 2.4.7
// Focus Visible, niveau AA).
const CHAMP = "w-full rounded-lg border px-3 py-3 text-sm focus:outline-none focus:ring-1";
const CHAMP_OK = "border-gray-300 focus:border-brand focus:ring-brand";
const CHAMP_KO = "border-danger focus:border-danger focus:ring-danger";

/**
 * Un `<input type="number">` contrôlé par un nombre est inutilisable pour saisir une décimale :
 * dès que l'opérateur tape le séparateur, Chrome considère « 4. » comme invalide et renvoie une
 * chaîne vide, le parent recalcule `Number("") = 0`, et React réécrit « 0 » dans le champ — taper
 * « 4.2 » donnait « 2 ». La virgule du clavier français était en plus purement et simplement
 * refusée. On garde donc la frappe brute en local et on ne remonte au parent qu'une valeur
 * normalisée (virgule → point), que son `Number(...)` sait lire, y compris pendant la frappe.
 */
function ChampDecimal({ className, error, value, defaultValue, onChange, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  // Certains écrans passent `defaultValue` (champ non contrôlé, enregistré au blur) : dans ce cas
  // la frappe locale fait foi et rien ne doit venir l'écraser.
  const controle = value !== undefined;
  const externe = value == null ? "" : String(value);
  const [texte, setTexte] = useState(String((controle ? value : defaultValue) ?? ""));
  const [enSaisie, setEnSaisie] = useState(false);
  // Le parent peut fournir sa valeur après coup (chargement asynchrone) : on se recale tant que
  // l'opérateur n'a pas la main sur le champ.
  const dernierDefaut = useRef(defaultValue);
  useEffect(() => {
    if (controle || enSaisie || defaultValue === dernierDefaut.current) return;
    dernierDefaut.current = defaultValue;
    setTexte(String(defaultValue ?? ""));
  }, [controle, enSaisie, defaultValue]);
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      aria-invalid={!!error}
      value={!controle || enSaisie ? texte : externe}
      onFocus={(e) => { if (controle) setTexte(externe); setEnSaisie(true); props.onFocus?.(e); }}
      onBlur={(e) => { setEnSaisie(false); props.onBlur?.(e); }}
      onChange={(e) => {
        const brut = e.target.value.replace(",", ".").replace(/[^0-9.\-]/g, "");
        setTexte(brut);
        setEnSaisie(true);
        e.target.value = brut;
        onChange?.(e as ChangeEvent<HTMLInputElement>);
      }}
      className={cn(CHAMP, error ? CHAMP_KO : CHAMP_OK, className)}
    />
  );
}

export function Input({ className, label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const input = props.type === "number" ? (
    <ChampDecimal className={className} error={error} {...props} />
  ) : (
    <input
      aria-invalid={!!error}
      className={cn(CHAMP, error ? CHAMP_KO : CHAMP_OK, className)}
      {...props}
    />
  );
  const body = (
    <>
      {input}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </>
  );
  if (!label) return body;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {body}
    </label>
  );
}

export function Select({ className, label, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  const sel = (
    <select aria-invalid={!!error} className={cn(CHAMP, "bg-white", error ? CHAMP_KO : CHAMP_OK, className)} {...props}>
      {children}
    </select>
  );
  const body = (
    <>
      {sel}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </>
  );
  if (!label) return body;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {body}
    </label>
  );
}

export function Textarea({ className, label, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  const ta = <textarea aria-invalid={!!error} className={cn(CHAMP, error ? CHAMP_KO : CHAMP_OK, className)} rows={3} {...props} />;
  const body = (
    <>
      {ta}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </>
  );
  if (!label) return body;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {body}
    </label>
  );
}

/**
 * Une carte cliquable est un bouton : `<div onClick>` n'est ni focusable, ni activable au
 * clavier, ni annoncé par un lecteur d'écran — et le motif est employé 173 fois. On rend donc
 * un vrai `<button>` dès qu'un `onClick` est fourni, en neutralisant les styles de bouton natif.
 */
// Défaut n°6 de la recette navigateur (vague 2) : la carte « facture échue » de `/factures`
// (`border-danger`) restait grise. `cn()` (ligne 3) ne fait que concaténer les classes — il ne
// retire jamais un utilitaire concurrent, contrairement à `tailwind-merge` — donc `border-gray-200`
// du `base` ci-dessous et le `border-danger` passé en `className` coexistaient dans le même attribut
// `class`, sur la même propriété CSS (`border-color`) : c'est l'ordre des règles dans le CSS
// *compilé* par Tailwind qui décide laquelle gagne, pas l'ordre des classes dans la chaîne, et le
// gris gagnait systématiquement. Le même motif touchait au moins une quinzaine d'écrans qui posent
// `border-danger` sur un `<Card>` pour un bandeau d'erreur (`liste.erreur`) ou un lot à risque —
// tous rendaient une bordure grise. La bordure par défaut est donc exclusive : elle ne s'ajoute que
// si l'appelant n'a pas déjà posé sa propre couleur de bordure sémantique.
const BORDURE_PERSONNALISEE = /\bborder-(danger|warning|success|brand|ink|tpblue)(-[a-z0-9]+)?(\/\d+)?\b/;

export function Card({ children, className, onClick, ariaLabel }: { children: ReactNode; className?: string; onClick?: () => void; ariaLabel?: string }) {
  const base = cn("rounded-xl border bg-white p-4 shadow-sm", !BORDURE_PERSONNALISEE.test(className ?? "") && "border-gray-200");
  if (!onClick) return <div className={cn(base, className)}>{children}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(base, "w-full cursor-pointer text-left transition duration-150 ease-out hover:bg-gray-50 active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand", className)}
    >
      {children}
    </button>
  );
}

/**
 * Le badge portait sa couleur en `className` à chaque appel : le vert « conforme » existait en
 * neuf déclinaisons pour une seule idée, et 88 % des 60 appels contournaient les jetons. Les
 * neuf tables de statut métier (`STATUS_DEVIS`, `STATUS_PROJET`, `STATUTS_JANTE`…) déclarent
 * désormais un `ton` sémantique et non plus une classe ; `className` ne subsiste que pour la
 * mise en page (marges, largeur), plus pour la couleur.
 *
 * `whitespace-nowrap` : « Prêt à récupérer » et « Livré et facturé » se coupaient en deux lignes
 * dans la colonne de droite de `/jantes`, ce qui déformait toute la ligne. Un badge est une
 * étiquette : il tient sur une ligne, ou la colonne s'élargit.
 */
export function Badge({ children, className, tone }: { children: ReactNode; className?: string; tone?: TonBadge }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tone && CLASSES_TON[tone], className)}>{children}</span>;
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="font-display text-xl font-bold tracking-tight text-gray-900">{children}</h1>
      {action}
    </div>
  );
}

/**
 * État vide.
 *
 * Les 23 états vides du produit étaient du texte seul, sans issue : « Rien pour l'instant. »
 * n'apprend rien et ne mène nulle part. `action` porte le bouton qui remplit l'écran, `icon`
 * l'illustration discrète, et `children` l'explication de ce qui viendra s'y ranger.
 */
export function Empty({ children, icon, action }: { children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
      {icon && <span className="text-gray-300" aria-hidden>{icon}</span>}
      <div className="max-w-md">{children}</div>
      {action}
    </div>
  );
}

/**
 * « Enregistrement… », discret, à côté d'un groupe de champs qui écrivent au `blur`.
 *
 * Un champ enregistré au `blur` n'a pas de bouton à mettre en attente : le seul retour possible
 * est cette ligne. Sans elle, l'opérateur qui saisit une surface sur 4G quitte l'écran avant que
 * la valeur soit partie, et ne le sait jamais. `aria-live="polite"` l'annonce sans interrompre
 * la saisie en cours ; l'espace est réservé en permanence (`h-4`) pour que rien ne saute.
 */
export function EnregistrementEnCours({ actif, className }: { actif: boolean; className?: string }) {
  return (
    <p className={cn("flex h-4 items-center gap-1.5 text-xs text-gray-500", className)} aria-live="polite">
      {actif && (
        <>
          <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          Enregistrement…
        </>
      )}
    </p>
  );
}

export function Spinner({ taille = "md", className }: { taille?: "sm" | "md" | "lg"; className?: string }) {
  const dim = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-10 w-10 border-[3px]" }[taille];
  const pad = { sm: "p-2", md: "p-8", lg: "p-12" }[taille];
  return (
    <div className={cn("flex justify-center", pad, className)} role="status" aria-label="Chargement en cours">
      <div className={cn("animate-spin rounded-full border-brand border-t-transparent", dim)} />
    </div>
  );
}
