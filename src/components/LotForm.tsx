"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { Button, Input } from "@/components/ui";

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dansNMois(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return isoDate(d);
}

/**
 * Réception d'une poudre = création d'un vrai lot (`poudre_lots`), traçable et daté.
 * Le lot, le mouvement de stock et le recalage du compteur global sont faits par la RPC
 * `receptionner_lot` dans une seule transaction : deux appels distincts laissaient, en cas
 * d'échec du second, un lot sans mouvement et un stock faux.
 */
export default function LotForm({ poudreId, prixKgDefaut, onCreated }: { poudreId: string; prixKgDefaut?: number | null; onCreated?: () => void }) {
  const toast = useToast();
  const [numero, setNumero] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [quantiteKg, setQuantiteKg] = useState("");
  const [prixKg, setPrixKg] = useState(prixKgDefaut?.toString() ?? "");
  const [dlu, setDlu] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const qte = Number(quantiteKg);

    const { error: errLot } = await supabase.rpc("receptionner_lot", {
      p_poudre_id: poudreId,
      p_numero: numero,
      p_fournisseur: fournisseur || null,
      p_quantite_kg: qte,
      p_prix_kg: prixKg ? Number(prixKg) : null,
      p_dlu: dlu || null,
    });
    if (errLot) { setError(errorFr(errLot)); setLoading(false); return; }

    toast(`Lot ${numero} réceptionné`);
    setNumero(""); setFournisseur(""); setQuantiteKg(""); setPrixKg(prixKgDefaut?.toString() ?? ""); setDlu("");
    onCreated?.();
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="N° de lot *" value={numero} onChange={(e) => setNumero(e.target.value)} required />
        <Input placeholder="Fournisseur" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" step="0.01" min="0.01" placeholder="Quantité kg *" value={quantiteKg} onChange={(e) => setQuantiteKg(e.target.value)} required />
        <Input type="number" step="0.01" placeholder="Prix €/kg" value={prixKg} onChange={(e) => setPrixKg(e.target.value)} />
      </div>
      <Input label="Date limite d'utilisation (DLU)" type="date" value={dlu} onChange={(e) => setDlu(e.target.value)} />
      <div className="flex gap-2">
        {[6, 12].map((n) => (
          <Button key={n} type="button" variant="secondary" className="flex-1 py-3" onClick={() => setDlu(dansNMois(n))}>
            + {n} mois
          </Button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Traçabilité lot : utile en cas de réclamation client (décoloration, défaut) pour prouver quel lot a été utilisé.
        Au-delà de la DLU, le fabricant ne garantit plus le rendu.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || !numero || !quantiteKg}>{loading ? "…" : "Réceptionner ce lot"}</Button>
    </form>
  );
}
