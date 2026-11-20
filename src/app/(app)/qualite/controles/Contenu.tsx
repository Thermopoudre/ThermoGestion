"use client";
import { useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ControleForm from "@/components/ControleForm";
import { Badge, Card, Empty, PageTitle, Select, Spinner } from "@/components/ui";
import { dateFr } from "@/lib/utils";
import { useEtatUrl } from "@/lib/urlState";
import { useTitreDocument } from "@/lib/titre";
import { TYPES_CONTROLE, TYPE_CONTROLE_LABEL, resumeValeurs, verdictLabel, verdictTon } from "@/lib/qualite";
import type { Controle, ControleType } from "@/lib/types";

const VALEURS_FILTRE_TYPE: readonly (ControleType | "")[] = ["", ...TYPES_CONTROLE];

export default function ControlesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [controles, setControles] = useState<Controle[] | null>(null);
  // D10 — le filtre de type de contrôle vit dans l'URL (`?type=`) : un lien « Épaisseur » posé
  // ailleurs dans le produit doit ouvrir l'historique déjà filtré, pas la liste complète.
  const [filtreType, setFiltreType] = useEtatUrl<ControleType | "">("type", "", VALEURS_FILTRE_TYPE);

  async function reload() {
    let query = supabase
      .from("controles")
      .select("*, projets(numero, nom), instruments(nom)")
      .order("mesure_at", { ascending: false })
      .limit(150);
    if (filtreType) query = query.eq("type", filtreType);
    const { data } = await query;
    setControles((data as unknown as Controle[]) ?? []);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filtreType]);

  async function voirPhoto(path: string) {
    const { data } = await supabase.storage.from("photos").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  useTitreDocument("Contrôles qualité");

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle>Contrôles qualité</PageTitle>

      <Card>
        <ControleForm onSaved={reload} />
      </Card>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">Historique</div>
        <Select value={filtreType} onChange={(e) => setFiltreType(e.target.value as ControleType | "")} className="w-auto">
          <option value="">Tous les types</option>
          {TYPES_CONTROLE.map((t) => <option key={t} value={t}>{TYPE_CONTROLE_LABEL[t]}</option>)}
        </Select>
      </div>

      {controles === null ? (
        <Spinner />
      ) : controles.length === 0 ? (
        <Empty>Aucun contrôle enregistré pour l&apos;instant.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {controles.map((c) => (
            <Card key={c.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{TYPE_CONTROLE_LABEL[c.type]}</span>
                  {c.projets?.nom && <span className="truncate text-xs text-gray-500">{c.projets.numero ? `${c.projets.numero} — ` : ""}{c.projets.nom}</span>}
                </div>
                <div className="text-sm text-gray-700">{resumeValeurs(c.type, c.valeurs)}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                  <span>{dateFr(c.mesure_at)}</span>
                  {c.instruments?.nom && <span>· {c.instruments.nom}</span>}
                  {c.photo_url && (
                    <button type="button" className="font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => voirPhoto(c.photo_url!)}><Camera size={13} aria-hidden className="mr-0.5 inline-block align-[-2px]" />photo</button>
                  )}
                </div>
                {c.commentaire && <div className="mt-1 text-xs text-gray-600">{c.commentaire}</div>}
              </div>
              <Badge tone={verdictTon(c.conforme)}>{verdictLabel(c.conforme)}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
