"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";

export type AdresseChoisie = {
  adresse: string;
  code_postal: string;
  ville: string;
  latitude: number | null;
  longitude: number | null;
  verifiee: boolean;
};

/**
 * Champ adresse avec suggestions de la Base Adresse Nationale.
 * L'utilisateur reste libre de taper ce qu'il veut (adresse de zone industrielle mal référencée,
 * lieu-dit…) : on ne bloque pas, on marque simplement l'adresse comme non vérifiée.
 */
export default function AdresseInput({
  label = "Adresse",
  valeur,
  codePostal,
  onChoisir,
  onSaisieLibre,
}: {
  label?: string;
  valeur: string;
  codePostal?: string;
  onChoisir: (a: AdresseChoisie) => void;
  onSaisieLibre: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<AdresseChoisie[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const dernierChoix = useRef("");
  // Une adresse déjà enregistrée ne doit pas ouvrir la liste au chargement de l'écran : on
  // n'interroge la BAN que quand l'opérateur est réellement en train de saisir.
  const [actif, setActif] = useState(false);

  useEffect(() => {
    if (!actif || valeur.length < 3 || valeur === dernierChoix.current) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setChargement(true);
      try {
        const url = `/api/adresse?q=${encodeURIComponent(valeur)}${codePostal ? `&cp=${codePostal}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(
          (data.resultats ?? []).map((r: AdresseChoisie & { score: number }) => ({
            adresse: r.adresse,
            code_postal: r.code_postal,
            ville: r.ville,
            latitude: r.latitude,
            longitude: r.longitude,
            verifiee: r.score >= 0.6,
          }))
        );
        setOuvert(true);
      } finally {
        setChargement(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [actif, valeur, codePostal]);

  return (
    <div className="relative">
      <Input
        label={label}
        value={valeur}
        onChange={(e) => { setActif(true); onSaisieLibre(e.target.value); }}
        onFocus={() => { setActif(true); if (suggestions.length > 0) setOuvert(true); }}
        onBlur={() => setTimeout(() => { setOuvert(false); setActif(false); }, 150)}
        placeholder="Numéro et rue"
        autoComplete="off"
      />
      {chargement && <span className="absolute right-3 top-9 text-xs text-gray-400">…</span>}
      {ouvert && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  dernierChoix.current = s.adresse;
                  onChoisir(s);
                  setOuvert(false);
                  setSuggestions([]);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="font-medium">{s.adresse}</span>
                <span className="text-gray-500"> · {s.code_postal} {s.ville}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
