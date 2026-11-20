"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Checklist de démarrage.
 *
 * Un atelier qui vient de s'inscrire arrive sur un tableau de bord vide : il ne manque pas une
 * fonctionnalité, il manque l'ordre dans lequel s'y prendre. C'est ce moment-là qui décide si
 * l'essai se transforme.
 *
 * Depuis que le métier est demandé à l'inscription, la grille tarifaire n'est plus vide mais
 * **pré-remplie de valeurs à corriger** : l'étape ne dit donc plus « réglez votre grille » mais
 * « vérifiez vos prix », qui est le vrai geste. Une grille livrée avec des prix du marché et
 * jamais relue est plus dangereuse qu'une grille vide.
 *
 * Chaque étape se coche sur la donnée réelle, jamais sur « j'ai vu l'écran ».
 */

type Etat = { numerotation: boolean; prix: boolean; client: boolean; poudre: boolean; devis: boolean };

const ETAPES: { cle: keyof Etat; titre: string; pourquoi: string; href: string; cta: string }[] = [
  {
    cle: "numerotation",
    titre: "Reprenez votre numérotation",
    pourquoi:
      "Vous n'en êtes pas à votre première facture. Si nous repartons à 0001 alors que vous en êtes à 0347, votre exercice porte deux séries pour la même année et votre comptable refusera le fichier des écritures. Cela se règle en deux minutes — mais avant votre première facture, pas après.",
    href: "/reglages?onglet=numerotation",
    cta: "Poser ma numérotation",
  },
  {
    cle: "prix",
    titre: "Vérifiez vos prix",
    pourquoi:
      "Nous avons posé une grille de départ avec des ordres de grandeur du marché. Ce ne sont pas vos prix. Dix minutes ici valent tous les devis que vous ferez ensuite en deux minutes.",
    // D10 — le lien ouvrait /reglages sur son premier onglet (« Atelier »), jamais sur la grille
    // tarifaire promise par le bouton. `?onglet=grille` est désormais lu ET conservé par
    // `/reglages` (voir useEtatUrl, lib/urlState.ts).
    href: "/reglages?onglet=grille",
    cta: "Ouvrir ma grille",
  },
  {
    cle: "client",
    titre: "Amenez vos clients",
    pourquoi:
      "Vous les avez déjà quelque part : un tableur, un logiciel de facturation, un export. Importez le fichier tel quel plutôt que de ressaisir un dimanche — l'import reconnaît les intitulés de colonnes courants.",
    href: "/import",
    cta: "Importer depuis un tableur",
  },
  {
    cle: "poudre",
    titre: "Ajoutez une poudre",
    pourquoi:
      "Importez-la du catalogue Thermopoudre : le RAL, le cycle de cuisson, le rendement et le prix au kilo arrivent avec, et ils sont justes.",
    href: "/stock",
    cta: "Ouvrir le stock",
  },
  {
    cle: "devis",
    titre: "Envoyez votre premier devis",
    pourquoi:
      "Votre client le signe depuis son téléphone, sans compte ni application. À la seconde où il signe, le chantier existe dans votre atelier.",
    href: "/devis/new",
    cta: "Créer un devis",
  },
];

export default function ChecklistDemarrage() {
  const [etat, setEtat] = useState<Etat | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [clients, poudres, devis, atelier, numerotation] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("archive", false),
        supabase.from("poudres").select("id", { count: "exact", head: true }).eq("actif", true),
        // Un devis en brouillon n'est pas un devis envoyé : l'étape n'est franchie que quand le
        // client l'a reçu.
        supabase.from("devis").select("id", { count: "exact", head: true }).neq("status", "brouillon"),
        // « Vérifiés » se coche sur un horodatage posé par l'écran de réglages, et non sur
        // l'existence d'un prix : depuis le pré-remplissage, un prix existe toujours, et cocher
        // dessus reviendrait à valider des tarifs que personne n'a lus.
        supabase.from("ateliers").select("settings").maybeSingle(),
        supabase.rpc("ma_numerotation"),
      ]);
      const settings = (atelier.data?.settings as Record<string, unknown> | null) ?? {};
      const lignesNum = (numerotation.data as { verrouille: boolean }[] | null) ?? [];
      setEtat({
        /**
         * Deux façons de cocher, et les deux sont des faits.
         *
         * Soit le responsable a posé sa numérotation — `settings.numerotation` porte alors les
         * préfixes qu'il a validés. Soit tous les types de documents ont déjà une série ouverte :
         * la question ne se pose plus, le compteur ne se déplace plus, et laisser l'étape ouverte
         * demanderait à l'atelier quelque chose que la base refuse.
         */
        numerotation:
          Object.keys((settings.numerotation as Record<string, unknown> | null) ?? {}).length > 0 ||
          (lignesNum.length > 0 && lignesNum.every((l) => l.verrouille)),
        prix: !!settings.prix_verifies_at,
        client: (clients.count ?? 0) > 0,
        poudre: (poudres.count ?? 0) > 0,
        devis: (devis.count ?? 0) > 0,
      });
    })();
  }, []);

  if (!etat) return null;
  const faites = ETAPES.filter((e) => etat[e.cle]).length;
  if (faites === ETAPES.length) return null;

  const prochaine = ETAPES.find((e) => !etat[e.cle])!;

  return (
    <section
      aria-labelledby="checklist-titre"
      className="rounded-xl border border-brand/30 bg-brand-light/40 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="checklist-titre" className="font-display text-sm font-semibold text-brand-dark">
          Prise en main — {faites} étape{faites > 1 ? "s" : ""} sur {ETAPES.length}
        </h2>
        <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(faites / ETAPES.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {ETAPES.map((e) => {
          const faite = etat[e.cle];
          const active = e.cle === prochaine.cle;
          return (
            <li
              key={e.cle}
              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${active ? "bg-white shadow-sm" : ""}`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  faite ? "border-brand bg-brand text-white" : "border-gray-300 bg-white"
                }`}
              >
                {faite && <Check size={13} strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${faite ? "text-gray-400 line-through" : "text-gray-900"}`}>
                  {e.titre}
                </div>
                {active && (
                  <>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{e.pourquoi}</p>
                    <Link
                      href={e.href}
                      className="mt-2 inline-block rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {e.cta} →
                    </Link>
                  </>
                )}
              </div>
              <span className="sr-only">{faite ? "fait" : "à faire"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
