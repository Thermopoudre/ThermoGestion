"use client";
import { useState } from "react";
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { nombreFr } from "@/lib/utils";
import type { FicheTp } from "@/lib/thermopoudre/fiche";

export type TeinteChoisie = {
  teinte_origine: string | null;
  teinte_reference: string | null;
  tp_product_id: number | null;
};

/**
 * Recherche de la teinte d'origine constructeur dans le catalogue Thermopoudre.
 *
 * C'est le seul endroit du produit où l'avantage concurrentiel réel de l'atelier devient une
 * fonction : la boutique tient un arbre de teintes d'origine constructeur (`famille`
 * `jante_oem`), avec le constructeur et le coloris. Un garage cherche « Golf 8 GTI » ou
 * « Frozen Grey » ; il ne cherche jamais un RAL.
 *
 * Les résultats d'origine constructeur remontent en tête : sur « gris », une teinte OEM est
 * presque toujours la bonne réponse pour un jeu de jantes, une poudre RAL presque jamais.
 */
export default function TeinteOrigineSelecteur({
  valeur,
  onChange,
}: {
  valeur: TeinteChoisie;
  onChange: (t: TeinteChoisie) => void;
}) {
  const [q, setQ] = useState("");
  const [chargement, setChargement] = useState(false);
  const [resultats, setResultats] = useState<FicheTp[] | null>(null);
  const [message, setMessage] = useState("");
  const [configure, setConfigure] = useState(true);

  async function chercher(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setChargement(true);
    setMessage("");
    try {
      const res = await fetch(`/api/catalogue/poudres?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setConfigure(data.configure !== false);
      const liste = (data.resultats ?? []) as FicheTp[];
      setResultats([...liste].sort((a, b) => Number(b.famille === "jante_oem") - Number(a.famille === "jante_oem")));
      if (data.message) setMessage(data.message);
    } catch {
      setResultats([]);
      setMessage("Le catalogue Thermopoudre n'a pas répondu.");
    }
    setChargement(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
      <div className="text-sm font-semibold">Teinte d&apos;origine du véhicule</div>
      <p className="-mt-1 text-xs text-gray-500">
        Elle se retient sur le véhicule : le jeu suivant de la même voiture sera préchiffré tout seul.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Teinte"
          value={valeur.teinte_origine ?? ""}
          placeholder="Frozen Grey"
          onChange={(e) => onChange({ ...valeur, teinte_origine: e.target.value || null })}
        />
        <Input
          label="Référence constructeur"
          value={valeur.teinte_reference ?? ""}
          placeholder="C3Z"
          onChange={(e) => onChange({ ...valeur, teinte_reference: e.target.value || null })}
        />
      </div>

      <form onSubmit={chercher} className="flex gap-2">
        <div className="flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="BMW Frozen Grey, Golf GTI, gris anthracite…"
            aria-label="Chercher la teinte d'origine dans le catalogue Thermopoudre"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={chargement || q.trim().length < 2}>
          {chargement ? "…" : "Chercher"}
        </Button>
      </form>

      {!configure && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
          Catalogue Thermopoudre non connecté — saisissez la teinte à la main, rien n&apos;est bloqué.
        </p>
      )}
      {configure && message && <p className="text-xs text-amber-700">{message}</p>}
      {chargement && <Spinner />}
      {resultats && resultats.length === 0 && !message && (
        <p className="text-xs text-gray-500">Aucune teinte trouvée pour « {q} ».</p>
      )}

      <div className="flex flex-col gap-1.5">
        {(resultats ?? []).slice(0, 8).map((f) => (
          <button
            key={f.tp_product_id}
            type="button"
            onClick={() =>
              onChange({
                teinte_origine: f.coloris ?? f.nom.replace(/^Thermopoudre\s*-\s*/i, "").split("|")[0].trim(),
                teinte_reference: f.reference ?? f.ral ?? null,
                tp_product_id: f.tp_product_id,
              })
            }
            className={`flex items-center gap-2 rounded-lg border p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              valeur.tp_product_id === f.tp_product_id ? "border-brand bg-brand-light" : "border-gray-200"
            }`}
          >
            {f.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.image} alt="" className="h-9 w-9 flex-none rounded object-contain" />
            ) : (
              <div className="h-9 w-9 flex-none rounded bg-gray-100" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{f.coloris ?? f.nom}</span>
                {f.famille === "jante_oem" && <Badge tone="info">Constructeur</Badge>}
              </span>
              <span className="block truncate text-xs text-gray-500">
                {[f.constructeur, f.reference, f.ral ? `RAL ${f.ral}` : null, f.rendement_m2_kg ? `${nombreFr(f.rendement_m2_kg)} m²/kg` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </button>
        ))}
      </div>

      {valeur.tp_product_id && (
        <p className="text-xs text-brand-dark">
          Teinte reliée au catalogue Thermopoudre — vous la retrouverez à la commande de poudre.
        </p>
      )}
    </div>
  );
}
