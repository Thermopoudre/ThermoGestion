"use client";
import { useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, EnregistrementEnCours, Input, Select } from "@/components/ui";
import { useEcriture } from "@/components/useEcriture";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { ACCEPT_PHOTO, cheminPhoto, refusDePhoto } from "@/lib/stockage";
import { ETATS_JANTE, OPERATIONS_JANTE, POSITIONS_JANTE, STATUTS_JANTE } from "@/lib/jantes";
import type { Jante, OperationJante, StatutJante } from "@/lib/types";

type PhotoAffichee = { id: string; url: string };

/**
 * Une jante du jeu : son état constaté, ses photos, ses opérations mécaniques et son statut.
 *
 * Les photos sont rattachées à la jante et non au dossier. C'est la seule forme utile en litige :
 * « votre jante avant droite était déjà voilée » ne se démontre pas avec quatre photos d'un tas
 * de jantes. La valeur unitaire est élevée, la preuve doit l'être aussi.
 */
export default function JanteCarte({
  jante,
  atelierId,
  jeuId,
  lectureSeule,
  onChange,
}: {
  jante: Jante;
  atelierId: string;
  jeuId: string;
  lectureSeule?: boolean;
  onChange: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [photos, setPhotos] = useState<PhotoAffichee[]>([]);
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const { enCours, suivre } = useEcriture();

  /**
   * Ce qu'on a envoyé et que le parent ne nous a pas encore renvoyé.
   *
   * LE BOGUE. `patch()` écrit, puis appelle `onChange()` qui fait recharger le jeu au parent. Sur
   * 4G, il s'écoule facilement une seconde entre les deux. Pendant cette seconde, la prop `jante`
   * porte encore l'état d'AVANT le premier appui. Un opérateur qui coche « Rayures » puis
   * « Chocs » calculait donc son second basculement à partir de la liste d'avant « Rayures » :
   * le second appui envoyait `["chocs"]` et **annulait le premier**. Avec des gants et une liste
   * de six défauts, c'est le cas courant, pas le cas limite.
   *
   * On tient donc localement la vérité de ce qu'on a envoyé, on affiche ça, et on la relâche
   * seulement quand le parent nous renvoie une version qui la contient. Pas de blocage du bouton :
   * l'opérateur doit pouvoir cocher ses quatre défauts au rythme de sa main.
   */
  const [optimiste, setOptimiste] = useState<Partial<Jante> | null>(null);
  useEffect(() => {
    if (!optimiste) return;
    const rattrape = (Object.keys(optimiste) as (keyof Jante)[]).every(
      (k) => JSON.stringify(jante[k]) === JSON.stringify(optimiste[k]),
    );
    if (rattrape) setOptimiste(null);
  }, [jante, optimiste]);

  /** La jante telle qu'elle doit s'afficher : la base, corrigée de ce qui est encore en vol. */
  const vue: Jante = optimiste ? { ...jante, ...optimiste } : jante;

  const position = POSITIONS_JANTE.find((p) => p.code === jante.position);
  const st = STATUTS_JANTE[vue.statut] ?? STATUTS_JANTE.a_faire;

  async function chargerPhotos() {
    const { data } = await supabase
      .from("photos")
      .select("id, storage_path")
      .eq("jante_id", jante.id)
      .order("created_at");
    const lignes = (data ?? []) as { id: string; storage_path: string }[];
    const signees = await Promise.all(
      lignes.map(async (p) => {
        const { data: s } = await supabase.storage.from("photos").createSignedUrl(p.storage_path, 3600);
        return { id: p.id, url: s?.signedUrl ?? "" };
      }),
    );
    setPhotos(signees.filter((p) => p.url));
  }
  useEffect(() => { chargerPhotos(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [jante.id]);

  async function televerser(files: FileList) {
    setBusy(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const refus = refusDePhoto(file);
      if (refus) { toast(refus, "error"); continue; }
      const chemin = cheminPhoto(atelierId, "jantes", [jeuId, jante.id], file.name, `${Date.now()}-${i}`);
      const { error: errUp } = await supabase.storage.from("photos").upload(chemin, file);
      if (errUp) { toast(errorFr(errUp), "error"); continue; }
      // L'erreur d'insertion est remontée, pas avalée : une photo présente dans le Storage et
      // absente de la table est invisible du bon public — c'est ce qui a laissé cinq réceptions
      // sans une seule photo exploitable.
      const { error: errIns } = await supabase.from("photos").insert({
        atelier_id: atelierId, jeu_jantes_id: jeuId, jante_id: jante.id,
        etape_code: "reception", storage_path: chemin, taille_bytes: file.size,
      });
      if (errIns) toast(errorFr(errIns), "error");
    }
    await chargerPhotos();
    setBusy(false);
  }

  async function patch(champs: Partial<Jante>) {
    // On affiche le résultat AVANT de partir sur le réseau : c'est ce qui rend le second appui
    // sûr. En cas d'échec, on relâche l'optimisme et la valeur de la base réapparaît.
    setOptimiste((o) => ({ ...o, ...champs }));
    await suivre(async () => {
      const { error } = await supabase.from("jantes").update(champs).eq("id", jante.id);
      if (error) { toast(errorFr(error), "error"); setOptimiste(null); return; }
      onChange();
    });
  }

  function basculer<T extends string>(liste: readonly T[] | T[], valeur: T): T[] {
    return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
  }

  // `vue` et non `jante` : le basculement suivant doit repartir de ce que l'opérateur voit.
  const etats = (vue.etat_constate ?? []) as string[];
  const operations = (vue.operations ?? []) as OperationJante[];

  return (
    <Card className="flex flex-col gap-2">
      {/* D9 — le chevron était mort : seule la moitié gauche de l'en-tête (icône + libellé)
          dépliait la carte, le bouton s'arrêtant avant le badge et le chevron. Toute la ligne est
          maintenant le déclencheur — chevron compris. */}
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-expanded={ouvert}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
            {position?.court ?? jante.position}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{position?.libelle ?? jante.position}</span>
            <span className="block truncate text-xs text-gray-500">
              {etats.length ? etats.map((e) => ETATS_JANTE[e] ?? e).join(", ") : "État non constaté"}
              {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}
            </span>
          </span>
        </span>
        <span className="flex flex-none items-center gap-2">
          <EnregistrementEnCours actif={enCours} />
          <Badge tone={st.ton}>{st.label}</Badge>
          <span className="text-xs text-gray-400" aria-hidden>{ouvert ? "▲" : "▼"}</span>
        </span>
      </button>

      {etats.length === 0 && photos.length === 0 && (
        <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          Ni état constaté ni photo. Sans preuve datée, « ma jante était intacte à l&apos;arrivée »
          l&apos;emporte toujours.
        </p>
      )}

      {ouvert && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" className="aspect-square rounded-lg object-cover" />
            ))}
          </div>
          {!lectureSeule && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-medium text-white active:bg-brand-dark">
              <Camera size={18} aria-hidden /> {busy ? "Envoi…" : `Photographier ${position?.court ?? ""}`}
              <input
                type="file" accept={ACCEPT_PHOTO} capture="environment" multiple className="hidden" disabled={busy}
                onChange={(e) => { if (e.target.files?.length) televerser(e.target.files); e.target.value = ""; }}
              />
            </label>
          )}

          <div>
            <div className="mb-1 text-xs font-medium text-gray-600">État constaté</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ETATS_JANTE).map(([code, libelle]) => (
                <button
                  key={code}
                  type="button"
                  disabled={lectureSeule}
                  onClick={() => patch({ etat_constate: basculer(etats, code) })}
                  aria-pressed={etats.includes(code)}
                  className={`min-h-[44px] rounded-full px-3.5 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    etats.includes(code) ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>
          </div>

          {etats.includes("voile") && (
            <Input
              label="Voile mesuré (mm)"
              type="number" step="0.1" min="0"
              defaultValue={vue.voile_mm ?? ""}
              disabled={lectureSeule}
              onBlur={(e) => patch({ voile_mm: e.target.value === "" ? null : Number(e.target.value) })}
            />
          )}

          <div>
            <div className="mb-1 text-xs font-medium text-gray-600">Opérations sur cette jante</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(OPERATIONS_JANTE) as OperationJante[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={lectureSeule}
                  onClick={() => patch({ operations: basculer(operations, code) })}
                  aria-pressed={operations.includes(code)}
                  className={`min-h-[44px] rounded-full px-3.5 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    operations.includes(code) ? "bg-brand-light text-brand-dark" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {OPERATIONS_JANTE[code]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Statut"
              value={vue.statut}
              disabled={lectureSeule}
              onChange={(e) => patch({ statut: e.target.value as StatutJante })}
            >
              {(Object.keys(STATUTS_JANTE) as StatutJante[]).map((s) => (
                <option key={s} value={s}>{STATUTS_JANTE[s].label}</option>
              ))}
            </Select>
            <Input
              label="Réserves"
              defaultValue={vue.reserves ?? ""}
              disabled={lectureSeule}
              placeholder="Capteur TPMS déjà fissuré…"
              onBlur={(e) => patch({ reserves: e.target.value || null })}
            />
          </div>
        </>
      )}
    </Card>
  );
}
