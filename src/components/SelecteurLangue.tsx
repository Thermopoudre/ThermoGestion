"use client";
import { useEffect, useState } from "react";
import { LANGUES, NOM_LANGUE, langueInitiale, type Langue } from "@/lib/i18n";

/**
 * Bascule de langue des pages publiques.
 *
 * Le choix est appliqué côté navigateur et non par une route `/it/...` : ces pages sont ouvertes
 * depuis un lien envoyé par mail ou par WhatsApp, et l'atelier ne doit pas avoir à choisir la
 * bonne URL. Il peut le faire s'il le veut, en ajoutant `?lang=it` — c'est le paramètre qui prime.
 *
 * Le choix est mémorisé : un client italien qui revient sur sa facture ne rebascule pas en français.
 */
export default function SelecteurLangue({ onChange }: { onChange: (l: Langue) => void }) {
  const [langue, setLangue] = useState<Langue>("fr");

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("lang");
    const initiale = langueInitiale(param);
    setLangue(initiale);
    onChange(initiale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choisir(l: Langue) {
    setLangue(l);
    onChange(l);
    try {
      window.localStorage.setItem("tg_langue", l);
    } catch {
      // Navigation privée : le choix vaut pour la page en cours, c'est déjà l'essentiel.
    }
  }

  return (
    <div className="flex gap-1 print:hidden" role="group" aria-label="Langue / Lingua">
      {LANGUES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choisir(l)}
          aria-pressed={langue === l}
          className={`rounded px-2 py-1 text-[11px] font-semibold uppercase transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            langue === l ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-500 hover:bg-gray-50"
          }`}
          title={NOM_LANGUE[l]}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
