"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import DevisEditor from "@/components/DevisEditor";
import { Button, Card, PageTitle, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { dateFr, eur } from "@/lib/utils";

type ClientOption = { id: string; nom: string };
type DernierDevis = { id: string; numero: string | null; created_at: string; total_ttc: number | string };

/**
 * B7 (second volet) — « Reprendre le dernier devis de ce client », pour le menuisier qui refait
 * le même portail chaque semaine : sept gestes avant ce chantier (ouvrir le client, chercher son
 * dernier devis, l'ouvrir, dupliquer, revenir). Un panneau au-dessus de l'éditeur, qui n'écrit
 * rien lui-même : `dupliquer_devis` (déjà utilisée depuis la fiche) fait tout le travail, la copie
 * s'ouvre directement dessus.
 *
 * `DevisEditor` reste tel quel (hors périmètre de ce chantier) : ce panneau est une porte d'entrée
 * de plus, pas une modification de la sienne.
 */
export default function NewDevisPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [dernier, setDernier] = useState<DernierDevis | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [reprise, setReprise] = useState(false);

  useTitreDocument("Nouveau devis");

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, nom")
      .eq("archive", false)
      .order("nom")
      .limit(500)
      .then(({ data }) => setClients((data as ClientOption[]) ?? []));
  }, [supabase]);

  useEffect(() => {
    if (!clientId) { setDernier(null); return; }
    let annule = false;
    setRecherche(true);
    supabase
      .from("devis")
      .select("id, numero, created_at, total_ttc")
      .eq("client_id", clientId)
      .neq("status", "brouillon")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (annule) return;
        setDernier((data as DernierDevis | null) ?? null);
        setRecherche(false);
      });
    return () => { annule = true; };
  }, [clientId, supabase]);

  async function reprendre() {
    if (!dernier) return;
    setReprise(true);
    const { data, error } = await supabase.rpc("dupliquer_devis", { p_id: dernier.id });
    setReprise(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Copie créée en brouillon");
    router.push(`/devis/${data as string}`);
  }

  return (
    // Pas de `md:max-w-2xl` : l'éditeur de devis occupait 672 px au milieu de 1 664 px
    // disponibles. Mobile-first à l'atelier, large au bureau — c'est ici le bureau.
    <div>
      <PageTitle>Nouveau devis</PageTitle>

      {/* Audit design du 20/11/2026 : ouvert, ce bloc poussait l'éditeur sous la ligne de flottaison
          au téléphone, alors que la reprise sert une fois sur dix. Replié par défaut, le titre
          reste visible et s'ouvre d'un geste. */}
      <details className="group mb-4 md:max-w-md">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <Copy size={16} aria-hidden /> <span className="flex-1">Reprendre un devis existant</span>
        <ChevronRight size={16} aria-hidden className="transition group-open:rotate-90" />
      </summary>
      <Card className="mt-2 flex flex-col gap-2">
        <Select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">— Choisir un client —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
        {clientId && !recherche && dernier && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-2 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{dernier.numero ?? "Brouillon"}</div>
              <div className="text-xs text-gray-500">{dateFr(dernier.created_at)} · {eur(dernier.total_ttc)} TTC</div>
            </div>
            <Button variant="secondary" onClick={reprendre} loading={reprise}>
              <span className="flex items-center gap-1.5"><Copy size={14} aria-hidden /> Reprendre</span>
            </Button>
          </div>
        )}
        {clientId && !recherche && !dernier && (
          <p className="text-xs text-gray-500">Aucun devis finalisé pour ce client — le premier se fait ci-dessous.</p>
        )}
        <p className="flex items-center gap-1 text-xs text-gray-500">
          <ChevronRight size={12} aria-hidden /> Reprendre crée une copie en brouillon, avec les mêmes lignes et la même remise — pratique pour le client qui recommande la même chose.
        </p>
      </Card>
      </details>

      <DevisEditor />
    </div>
  );
}
