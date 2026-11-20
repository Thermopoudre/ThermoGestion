"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ecrire } from "@/lib/db";
import { eur, libelleTypePoudre, nombreFr } from "@/lib/utils";
import { referenceAtelier, type FicheTp } from "@/lib/thermopoudre/fiche";

/**
 * Catalogue Thermopoudre intégré : l'atelier cherche une teinte et l'importe dans son stock en un
 * clic, au lieu d'ouvrir la boutique dans un autre onglet et de recopier huit champs à la main.
 *
 * Le lien avec la boutique est conservé (`poudres.tp_product_id`) : c'est lui qui permettra de
 * recommander la bonne référence, et non une recherche par mot-clé approximative.
 */
export default function CatalogueThermopoudre({ dejaImportes = [] }: { dejaImportes?: number[] }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [chargement, setChargement] = useState(false);
  const [resultats, setResultats] = useState<FicheTp[] | null>(null);
  const [message, setMessage] = useState("");
  const [configure, setConfigure] = useState(true);
  const [importEnCours, setImportEnCours] = useState<number | null>(null);
  const [importes, setImportes] = useState<number[]>(dejaImportes);

  async function chercher(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setChargement(true);
    setMessage("");
    try {
      const res = await fetch(`/api/catalogue/poudres?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setConfigure(data.configure !== false);
      setResultats(data.resultats ?? []);
      if (data.message) setMessage(data.message);
    } catch {
      setResultats([]);
      setMessage("Le catalogue Thermopoudre n'a pas répondu.");
    }
    setChargement(false);
  }

  async function importer(f: FicheTp) {
    setImportEnCours(f.tp_product_id);
    const supabase = createClient();
    const { data: membre } = await supabase.from("users").select("atelier_id").single();
    // Le rendement et le cycle de cuisson conditionnent le décompte de poudre et la compatibilité
    // de fournée : on pose les valeurs par défaut de l'atelier plutôt que du vide.
    const insertion = supabase.from("poudres").insert({
      atelier_id: membre!.atelier_id,
      marque: f.marque,
      reference: referenceAtelier(f),
      ral: f.ral,
      finition: f.finition,
      type: f.type,
      rendement_m2_kg: f.rendement_m2_kg ?? 8,
      temp_cuisson: f.temp_cuisson,
      duree_cuisson_min: f.duree_cuisson_min,
      seuil_alerte_kg: 5,
      stock_kg: 0,
      tp_product_id: f.tp_product_id,
      actif: true,
    }).select("id").single();
    // D8 — un import refusé (démo, abonnement expiré, RLS) affichait quand même « Fiche poudre
    // importée » : la requête était bien attendue, mais son `error` jamais lu avant d'annoncer le
    // succès. `ecrire()` est le seul chemin du produit qui ne peut pas se tromper sur ce point : il
    // renvoie `false` sans avoir affiché autre chose que le refus réel.
    const { data: creee, error } = await insertion;
    setImportEnCours(null);
    if (!(await ecrire(Promise.resolve({ error }), toast))) return;

    // Le prix d'achat du catalogue va dans `poudre_couts` : c'est un coût, il ne se range pas
    // dans la fiche que l'opérateur consulte. L'échec n'annule pas l'import — la fiche poudre
    // est utile sans son prix, l'inverse n'est pas vrai.
    if (creee && f.prix_kg != null) {
      await supabase.from("poudre_couts").upsert({
        poudre_id: (creee as { id: string }).id, atelier_id: membre!.atelier_id, prix_kg: f.prix_kg,
      });
    }
    setImportes([...importes, f.tp_product_id]);
    toast("Fiche poudre importée dans votre stock");
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <div className="text-sm font-semibold">Catalogue Thermopoudre</div>
        <p className="text-xs text-gray-500">
          Cherchez une teinte RAL, un coloris ou une teinte d&apos;origine constructeur, et importez
          la fiche dans votre stock : référence, cuisson, rendement et prix sont repris.
        </p>
      </div>

      <form onSubmit={chercher} className="flex gap-2">
        <div className="flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="RAL 9005, gris anthracite, Aston Martin…"
            aria-label="Rechercher dans le catalogue Thermopoudre"
          />
        </div>
        <Button type="submit" loading={chargement} disabled={q.trim().length < 2}>Chercher</Button>
      </form>

      {!configure && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <b>Catalogue Thermopoudre non connecté.</b> La recherche de teintes et l&apos;import de
          fiche poudre sont indisponibles tant que l&apos;accès à la boutique n&apos;est pas
          configuré. Vous pouvez créer vos poudres à la main sans attendre.
        </div>
      )}
      {configure && message && <p className="text-xs text-amber-700">{message}</p>}

      {chargement && <Spinner />}

      {resultats && resultats.length === 0 && !message && (
        <p className="text-xs text-gray-500">Aucune teinte trouvée pour « {q} ».</p>
      )}

      <div className="flex flex-col gap-2">
        {(resultats ?? []).map((f) => {
          const deja = importes.includes(f.tp_product_id);
          return (
            <div key={f.tp_product_id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-2">
              {f.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.image} alt="" className="h-12 w-12 flex-none rounded object-contain" />
              ) : (
                <div className="h-12 w-12 flex-none rounded bg-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{referenceAtelier(f)}</span>
                  {f.famille === "jante_oem" && <Badge tone="neutral">Teinte constructeur</Badge>}
                </div>
                <div className="text-xs text-gray-500">
                  {[
                    f.marque,
                    libelleTypePoudre(f.type),
                    f.temp_cuisson ? `${f.temp_cuisson} °C / ${f.duree_cuisson_min ?? "?"} min` : null,
                    f.rendement_m2_kg ? `${nombreFr(f.rendement_m2_kg)} m²/kg` : null,
                    f.prix_kg ? `${eur(f.prix_kg)}/kg` : null,
                  ].filter(Boolean).join(" · ")}
                </div>
                <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                  Voir la fiche sur thermopoudre.fr
                </a>
              </div>
              <Button
                variant={deja ? "secondary" : "primary"}
                disabled={deja}
                loading={importEnCours === f.tp_product_id}
                onClick={() => importer(f)}
                className="flex-none"
              >
                {deja ? "Importée" : "Importer"}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
