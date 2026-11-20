"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Image as ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { errorFr } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import ConfirmModal from "@/components/Modal";
import { Card, Spinner } from "@/components/ui";
import { dateFr } from "@/lib/utils";
import { usePlan } from "@/components/PlanProvider";
import {
  ACCEPT_HTML,
  AIDE_FORMATS,
  DUREE_URL_SIGNEE_S,
  cheminPieceJointe,
  familleFichier,
  refusDeFichier,
  tailleFr,
  type EntitePieceJointe,
} from "@/lib/pieces-jointes";

type Piece = {
  id: string;
  nom: string;
  mime: string;
  taille: number;
  storage_path: string;
  created_at: string;
};

/** Une icône par famille : au coup d'œil, on distingue le plan du client de la photo du défaut. */
function Icone({ mime }: { mime: string }) {
  const famille = familleFichier(mime);
  if (famille === "image") return <ImageIcon size={18} aria-hidden className="shrink-0 text-gray-400" />;
  if (famille === "tableur") return <FileSpreadsheet size={18} aria-hidden className="shrink-0 text-gray-400" />;
  return <FileText size={18} aria-hidden className="shrink-0 text-gray-400" />;
}

/**
 * Pièces jointes d'une fiche — client, projet ou réception.
 *
 * Trois précautions valent d'être expliquées, parce que chacune corrige un défaut observé :
 *
 *  1. **L'envoi et l'enregistrement sont deux écritures.** Sur les réceptions, la seconde
 *     échouait en silence : le fichier partait bien dans le bucket, la ligne n'était jamais
 *     créée, et l'écran se rechargeait comme si tout allait bien. Ici, l'insertion passe par
 *     `ecrire()` — et si elle échoue, **l'objet déposé est retiré du bucket** : mieux vaut ne
 *     rien avoir que d'accumuler des fichiers que plus aucune ligne ne désigne.
 *  2. **Les liens sont signés en une seule fois** (`createSignedUrls`, au pluriel). La version au
 *     singulier fait un aller-retour réseau par fichier ; à douze pièces sur la 4G d'un atelier,
 *     ça se voit.
 *  3. **Le nom d'origine est conservé.** Le chemin de stockage est assaini par nécessité
 *     technique, mais « Plan garde-corps – rév. 2.pdf » reste écrit tel quel à l'écran : un
 *     atelier doit reconnaître la pièce que son client lui a envoyée.
 */
export default function PiecesJointes({
  entite,
  entiteId,
  atelierId,
  titre = "Pièces jointes",
  aide,
}: {
  entite: EntitePieceJointe;
  entiteId: string;
  atelierId: string;
  titre?: string;
  /** Phrase qui explique ce qu'on range ici. Elle change selon la fiche : un plan n'est pas un bon de commande. */
  aide?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const { commercial } = usePlan();
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [liens, setLiens] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Piece | null>(null);

  /**
   * Ce qu'on attache à une FICHE CLIENT est du commercial : bon de commande, conditions
   * négociées signées, attestation d'assurance. La base le refuse désormais à l'opérateur — sur
   * la ligne comme sur le fichier — et l'écran doit dire pourquoi plutôt que d'afficher une
   * carte vide qui ressemble à une panne, ou un bouton d'envoi qui échouera.
   *
   * Les pièces d'un projet et d'une réception restent ouvertes à tous : elles décrivent le
   * travail à faire, et c'est l'atelier qui le fait.
   */
  const reserveAuBureau = entite === "client" && !commercial;

  const recharger = useCallback(async () => {
    if (reserveAuBureau) { setPieces([]); return; }
    const { data, error } = await supabase
      .from("pieces_jointes")
      .select("id, nom, mime, taille, storage_path, created_at")
      .eq("entite", entite)
      .eq("entite_id", entiteId)
      .order("created_at", { ascending: false });
    if (error) {
      // Un échec de lecture silencieux laisse la carte en chargement perpétuel : l'exploitant
      // croit à un réseau lent et attend une liste qui n'arrivera jamais.
      toast(errorFr(error), "error");
      setPieces([]);
      return;
    }
    const lignes = (data as Piece[]) ?? [];
    setPieces(lignes);
    if (lignes.length === 0) { setLiens({}); return; }
    // Un seul appel pour toute la liste, et une entrée par chemin réellement signé : une pièce
    // dont l'objet a disparu du bucket ne doit pas faire tomber les autres.
    const { data: signees } = await supabase.storage
      .from("documents")
      .createSignedUrls(lignes.map((p) => p.storage_path), DUREE_URL_SIGNEE_S);
    const table: Record<string, string> = {};
    for (const s of signees ?? []) if (s.path && s.signedUrl) table[s.path] = s.signedUrl;
    setLiens(table);
  }, [supabase, entite, entiteId, toast, reserveAuBureau]);

  useEffect(() => { recharger(); }, [recharger]);

  if (reserveAuBureau) {
    return (
      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip size={16} aria-hidden /> {titre}
        </div>
        <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          Les pièces attachées à une fiche client — bon de commande, conditions négociées signées,
          attestation d&apos;assurance — relèvent du bureau. Votre compte est un compte
          d&apos;atelier : vous retrouvez les plans et les documents de travail sur la fiche du
          projet et sur celle de la réception.
        </p>
      </Card>
    );
  }

  async function envoyer(fichiers: FileList) {
    setBusy(true);
    let ajoutees = 0;
    for (const fichier of Array.from(fichiers)) {
      // Le refus est prononcé avant l'envoi : un fichier de 40 Mo rejeté après trente secondes de
      // téléversement est la pire des attentes, et le message du service de stockage est en anglais.
      const refus = refusDeFichier(fichier);
      if (refus) { toast(refus, "error"); continue; }

      const chemin = cheminPieceJointe(atelierId, entite, entiteId, fichier.name);
      const { error: errEnvoi } = await supabase.storage
        .from("documents")
        .upload(chemin, fichier, { contentType: fichier.type });
      if (errEnvoi) { toast(errorFr(errEnvoi), "error"); continue; }

      const ok = await ecrire(
        supabase.from("pieces_jointes").insert({
          atelier_id: atelierId,
          entite,
          entite_id: entiteId,
          storage_path: chemin,
          nom: fichier.name.slice(0, 255),
          mime: fichier.type,
          taille: fichier.size,
        }),
        toast,
      );
      // Rattrapage : sans lui, le bucket se remplirait de fichiers orphelins qu'aucun écran ne
      // montre et qu'aucune purge ne connaît.
      if (!ok) { await supabase.storage.from("documents").remove([chemin]); continue; }
      ajoutees += 1;
    }
    if (ajoutees > 0) toast(ajoutees > 1 ? `${ajoutees} pièces ajoutées` : "Pièce ajoutée");
    await recharger();
    setBusy(false);
  }

  async function supprimer(piece: Piece) {
    setBusy(true);
    // La ligne d'abord, le fichier ensuite : dans l'ordre inverse, un refus de droits sur la
    // table laisserait une pièce visible dont l'objet a disparu — un lien mort permanent.
    const ok = await ecrire(
      supabase.from("pieces_jointes").delete().eq("id", piece.id),
      toast,
      "Pièce supprimée",
    );
    if (ok) await supabase.storage.from("documents").remove([piece.storage_path]);
    setASupprimer(null);
    await recharger();
    setBusy(false);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip size={16} aria-hidden /> {titre}
        </div>
        {pieces && pieces.length > 0 && (
          <span className="text-xs text-gray-500">{pieces.length} fichier{pieces.length > 1 ? "s" : ""}</span>
        )}
      </div>

      {aide && <p className="-mt-1 text-xs text-gray-500">{aide}</p>}

      {pieces === null ? (
        <Spinner taille="sm" />
      ) : pieces.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          Aucune pièce jointe. Rangez ici le plan, le bon de commande ou la fiche technique :
          le jour d&apos;un désaccord, ce qui n&apos;est pas dans le dossier n&apos;existe pas.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {pieces.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <Icone mime={p.mime} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.nom}</span>
                <span className="block text-2xs text-gray-500">{tailleFr(p.taille)} · {dateFr(p.created_at)}</span>
              </span>
              {/* `download` porte le nom d'origine : sans lui, le navigateur enregistre le fichier
                  sous le nom assaini du chemin de stockage, horodatage compris. */}
              <a
                href={liens[p.storage_path] ?? "#"}
                download={p.nom}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Télécharger ${p.nom}`}
                aria-disabled={!liens[p.storage_path]}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand aria-disabled:opacity-40"
              >
                <Download size={18} aria-hidden />
              </a>
              <button
                type="button"
                aria-label={`Supprimer ${p.nom}`}
                onClick={() => setASupprimer(p)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-danger hover:bg-danger-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-700 transition duration-150 ease-out hover:bg-gray-50 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
        <Paperclip size={18} aria-hidden />
        {busy ? "Envoi en cours…" : "Ajouter un fichier"}
        <input
          type="file"
          accept={ACCEPT_HTML}
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => { if (e.target.files?.length) envoyer(e.target.files); e.target.value = ""; }}
        />
      </label>
      <p className="-mt-1 text-2xs text-gray-400">{AIDE_FORMATS}</p>

      <ConfirmModal
        open={!!aSupprimer}
        title="Supprimer cette pièce jointe ?"
        message={aSupprimer ? `« ${aSupprimer.nom} » sera définitivement effacé. Contrairement aux devis et aux projets, une pièce jointe ne passe pas par la corbeille.` : undefined}
        confirmLabel="Supprimer"
        danger
        busy={busy}
        onCancel={() => setASupprimer(null)}
        onConfirm={() => aSupprimer && supprimer(aSupprimer)}
      />
    </Card>
  );
}
