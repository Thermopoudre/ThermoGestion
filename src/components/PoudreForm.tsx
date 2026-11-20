"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { Button, Input, Select } from "@/components/ui";
import AlerteDoublon from "@/components/AlerteDoublon";
import { usePlan } from "@/components/PlanProvider";
import { libelleFinitionPoudre, libelleTypePoudre } from "@/lib/utils";
import type { Poudre } from "@/lib/types";

export default function PoudreForm({ initial }: { initial?: Poudre }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    marque: initial?.marque ?? "",
    reference: initial?.reference ?? "",
    ral: initial?.ral ?? "",
    finition: initial?.finition ?? "",
    type: initial?.type ?? "",
    prix_kg: initial?.poudre_couts?.prix_kg?.toString() ?? "",
    rendement_m2_kg: initial?.rendement_m2_kg?.toString() ?? "8",
    seuil_alerte_kg: initial?.seuil_alerte_kg?.toString() ?? "5",
    temp_cuisson: initial?.temp_cuisson?.toString() ?? "180",
    duree_cuisson_min: initial?.duree_cuisson_min?.toString() ?? "15",
    epaisseur_um_min: initial?.epaisseur_um_min?.toString() ?? "",
    epaisseur_um_max: initial?.epaisseur_um_max?.toString() ?? "",
    fiche_technique_url: initial?.fiche_technique_url ?? "",
    fds_url: initial?.fds_url ?? "",
  });
  const [error, setError] = useState("");
  // Le champ « Prix €/kg » n'apparaît qu'aux rôles qui peuvent le lire en base. Le montrer à un
  // opérateur reviendrait à lui promettre une écriture que la policy refusera.
  const { commercial: prixAutorise } = usePlan();
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Un lien de fiche s'ouvre au poste, sur le téléphone de l'opérateur : on n'accepte qu'une
    // adresse web complète, jamais un `javascript:` ou un chemin local.
    const lienInvalide = [f.fiche_technique_url, f.fds_url].find((u) => u && !/^https?:\/\/\S+$/i.test(u.trim()));
    if (lienInvalide) { setError("Les liens de fiche doivent commencer par https://"); return; }
    setLoading(true);
    const supabase = createClient();
    const payload = {
      marque: f.marque || null, reference: f.reference, ral: f.ral || null, finition: f.finition || null, type: f.type || null,
      rendement_m2_kg: f.rendement_m2_kg ? Number(f.rendement_m2_kg) : null,
      seuil_alerte_kg: f.seuil_alerte_kg ? Number(f.seuil_alerte_kg) : null,
      temp_cuisson: f.temp_cuisson ? Number(f.temp_cuisson) : null, duree_cuisson_min: f.duree_cuisson_min ? Number(f.duree_cuisson_min) : null,
      epaisseur_um_min: f.epaisseur_um_min ? Number(f.epaisseur_um_min) : null,
      epaisseur_um_max: f.epaisseur_um_max ? Number(f.epaisseur_um_max) : null,
      fiche_technique_url: f.fiche_technique_url.trim() || null,
      fds_url: f.fds_url.trim() || null,
    };
    // Le prix d'achat n'est plus une colonne de `poudres` : il vit dans `poudre_couts`, table
    // fermée au rôle atelier. Deux écritures, donc — et la seconde n'est tentée que si l'écran a
    // pu afficher le champ, c'est-à-dire si le rôle y a droit.
    const prixKg = f.prix_kg ? Number(f.prix_kg) : null;
    let err;
    let poudreId = initial?.id ?? null;
    let atelierId = initial?.atelier_id ?? null;
    if (initial) ({ error: err } = await supabase.from("poudres").update(payload).eq("id", initial.id));
    else {
      const { data: membre } = await supabase.from("users").select("atelier_id").single();
      atelierId = membre!.atelier_id;
      const { data: creee, error: errInsert } = await supabase
        .from("poudres").insert({ ...payload, atelier_id: atelierId }).select("id").single();
      err = errInsert;
      poudreId = (creee as { id: string } | null)?.id ?? null;
    }
    if (err) { setError(errorFr(err)); setLoading(false); return; }

    if (prixAutorise && poudreId && atelierId) {
      const { error: errPrix } = await supabase
        .from("poudre_couts")
        .upsert({ poudre_id: poudreId, atelier_id: atelierId, prix_kg: prixKg });
      if (errPrix) { setError(errorFr(errPrix)); setLoading(false); return; }
    }
    toast("Poudre enregistrée");
    router.push("/stock");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Référence *" value={f.reference} onChange={set("reference")} required placeholder="Ex : RAL 9005 texturé" />
      {/* L'unicité en base porte sur « marque + référence » : deux fournisseurs peuvent vendre un
          RAL 9016 mat, avec deux rendements et deux prix. L'alerte, elle, regarde la seule
          référence — c'est la saisie en double chez le même fournisseur qu'on veut voir venir. */}
      <AlerteDoublon type="poudre" valeur={f.reference} exclureId={initial?.id} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Marque" value={f.marque} onChange={set("marque")} />
        <Input label="RAL / teinte" value={f.ral} onChange={set("ral")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* D7 — le sélecteur affichait le code technique ("satine", "texture", "metallise") tel
            quel : la valeur stockée reste le code (c'est lui que relit le reste de l'application),
            seul le texte affiché passe par le dictionnaire français. */}
        <Select label="Finition" value={f.finition} onChange={set("finition")}>
          <option value="">—</option>
          {["mat", "satine", "brillant", "texture", "metallise", "candy"].map((x) => <option key={x} value={x}>{libelleFinitionPoudre(x)}</option>)}
        </Select>
        <Select label="Type" value={f.type} onChange={set("type")}>
          <option value="">—</option>
          {["polyester", "epoxy", "epoxy-polyester", "primaire", "vernis"].map((x) => <option key={x} value={x}>{libelleTypePoudre(x)}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {prixAutorise && <Input label="Prix €/kg" type="number" step="0.01" value={f.prix_kg} onChange={set("prix_kg")} />}
        <Input label="Rendement m²/kg" type="number" step="0.1" value={f.rendement_m2_kg} onChange={set("rendement_m2_kg")} />
        <Input label="Seuil alerte kg" type="number" step="0.1" value={f.seuil_alerte_kg} onChange={set("seuil_alerte_kg")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Cuisson °C" type="number" value={f.temp_cuisson} onChange={set("temp_cuisson")} />
        <Input label="Durée min" type="number" value={f.duree_cuisson_min} onChange={set("duree_cuisson_min")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Épaisseur mini µm" type="number" value={f.epaisseur_um_min} onChange={set("epaisseur_um_min")} />
        <Input label="Épaisseur maxi µm" type="number" value={f.epaisseur_um_max} onChange={set("epaisseur_um_max")} />
      </div>
      <Input label="Lien fiche technique" type="url" inputMode="url" value={f.fiche_technique_url} onChange={set("fiche_technique_url")} placeholder="https://" />
      <Input label="Lien fiche de données de sécurité (FDS)" type="url" inputMode="url" value={f.fds_url} onChange={set("fds_url")} placeholder="https://" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {/* `loading` plutôt que remplacer le texte par « … » : l'opérateur doit continuer à lire
          sur quoi il vient d'appuyer (voir Button, components/ui.tsx). */}
      <Button type="submit" loading={loading} disabled={!f.reference}>Enregistrer</Button>
    </form>
  );
}
