"use client";
import { use, useEffect, useMemo, useState } from "react";
import { Camera, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import ReceptionForm from "@/components/ReceptionForm";
import PartagerLien from "@/components/PartagerLien";
import PiecesJointes from "@/components/PiecesJointes";
import BoutonCorbeille from "@/components/BoutonCorbeille";
import { useToast } from "@/components/Toast";
import { Badge, Card, PageTitle, Spinner } from "@/components/ui";
import { dateFr } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import { ACCEPT_PHOTO, cheminPhoto, refusDePhoto } from "@/lib/stockage";
import { ETAT_RECEPTION } from "@/lib/types";
import type { Reception } from "@/lib/types";
import { useTitreDocument } from "@/lib/titre";

type PhotoAffichee = { name: string; url: string };

export default function ReceptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [reception, setReception] = useState<Reception | null>(null);
  const [photos, setPhotos] = useState<PhotoAffichee[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  /**
   * Recharge la fiche et ses photos.
   *
   * L'écran listait le **bucket**, pas la table `photos`. Deux conséquences, et la seconde est
   * grave : une insertion refusée passait totalement inaperçue puisque la vignette apparaissait
   * quand même — l'atelier voyait ses photos, alors que la ligne n'existait pas. Or le bon de
   * réception public, le PDF et le dossier de litige lisent la **table**. C'est exactement ce qui
   * a produit des réceptions photographiées et une table `photos` vide en production.
   *
   * On lit donc la table, qui fait foi. Une photo présente dans le bucket sans sa ligne ne
   * s'affiche plus : c'est le comportement voulu, elle n'existe pour aucun autre écran.
   */
  async function reload() {
    const { data: r } = await supabase.from("receptions").select("*, clients(nom)").eq("id", id).single();
    if (!r) return;
    setReception(r as unknown as Reception);

    const { data: lignes, error } = await supabase
      .from("photos")
      .select("id, storage_path")
      .eq("reception_id", id)
      .order("created_at");
    if (error) { toast(errorFr(error), "error"); setPhotos([]); return; }
    const utiles = (lignes as { id: string; storage_path: string }[]) ?? [];
    if (utiles.length === 0) { setPhotos([]); return; }

    // `createSignedUrls`, au pluriel : la version au singulier faisait un aller-retour réseau par
    // photo. À douze clichés de réception sur la 4G d'un atelier, l'écran se remplissait une
    // vignette après l'autre.
    const { data: signees } = await supabase.storage
      .from("photos")
      .createSignedUrls(utiles.map((p) => p.storage_path), 3600);
    const parChemin = new Map((signees ?? []).map((s) => [s.path ?? "", s.signedUrl]));
    setPhotos(
      utiles
        .map((p) => ({ name: p.id, url: parChemin.get(p.storage_path) ?? "" }))
        .filter((p) => p.url),
    );
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useTitreDocument(reception ? `Réception ${reception.numero ?? "brouillon"} — ${reception.clients?.nom ?? ""}` : null);

  if (!reception) return <Spinner />;

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/rc/${reception.public_token}` : "";

  async function uploadPhotos(files: FileList) {
    setBusy(true);
    const r = reception!;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const refus = refusDePhoto(file);
      if (refus) { toast(refus, "error"); continue; }
      const path = cheminPhoto(r.atelier_id, "receptions", [id], file.name, `${Date.now()}-${i}`);
      const { error } = await supabase.storage.from("photos").upload(path, file);
      if (error) { toast(errorFr(error), "error"); continue; }
      // On trace toujours la photo via reception_id (même sans projet). Le bon public consulté
      // par le client, lui, ne reprend que les photos du projet rattaché : sans projet, elles
      // restent visibles côté atelier uniquement.
      //
      // L'envoi et l'enregistrement sont deux écritures distinctes. Si la seconde échoue, on
      // **retire le fichier déposé** : sans ce rattrapage, le bucket accumule des clichés que
      // plus aucune ligne ne désigne, invisibles de tous les écrans qui comptent — le bon public,
      // le PDF, le dossier de litige.
      const trace = await ecrire(
        supabase.from("photos").insert({
          atelier_id: r.atelier_id, projet_id: r.projet_id ?? null, reception_id: id, etape_code: "reception",
          storage_path: path, taille_bytes: file.size,
        }),
        toast,
      );
      if (!trace) await supabase.storage.from("photos").remove([path]);
    }
    await reload();
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle
        action={
          <Badge tone={reception.etat_constate === "bon" ? "success" : "warning"}>
            {ETAT_RECEPTION[reception.etat_constate]}
          </Badge>
        }
      >
        {reception.numero ?? "Réception"}
      </PageTitle>
      <div className="text-sm text-gray-600">
        {reception.clients?.nom} · {reception.nb_pieces} pièce{reception.nb_pieces > 1 ? "s" : ""} · reçu le {dateFr(reception.created_at)}
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Photos à la réception</div>
          <span className="text-xs text-gray-500">{photos.length} photo{photos.length > 1 ? "s" : ""}</span>
        </div>

        {photos.length === 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Aucune photo. Photographiez les pièces <b>maintenant</b>, sous plusieurs angles et de près
            sur chaque défaut : sans preuve datée, un client qui affirme « ma pièce était intacte à
            l&apos;arrivée » a toujours raison.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {photos.map((ph) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={ph.name} src={ph.url} alt="" className="aspect-square rounded-lg object-cover" />
          ))}
        </div>

        <label className="flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand py-4 text-base font-medium text-white transition duration-150 ease-out active:bg-brand-dark focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
          <Camera size={20} aria-hidden /> {busy ? "Envoi en cours…" : "Photographier les pièces"}
          <input
            type="file"
            accept={ACCEPT_PHOTO}
            capture="environment"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => { if (e.target.files?.length) uploadPhotos(e.target.files); e.target.value = ""; }}
          />
        </label>
        {!reception.projet_id && photos.length > 0 && (
          <p className="text-xs text-gray-500">
            Ces photos restent internes tant que la réception n&apos;est pas rattachée à un projet.
          </p>
        )}
      </Card>

      {reception.reserves && (
        <Card>
          <div className="mb-1 text-sm font-semibold">Réserves</div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{reception.reserves}</p>
        </Card>
      )}

      {/* La fiche technique du client, son bon de dépôt papier scanné, l'échange de mails qui
          fixe la teinte : ce qui n'est pas une photo de pièce mais qui compte autant. */}
      <PiecesJointes
        entite="reception"
        entiteId={id}
        atelierId={reception.atelier_id}
        aide="Bon de dépôt papier scanné, fiche technique, courriel qui fixe la teinte : ce qui accompagne les pièces sans être une photo."
      />

      <Card className="flex flex-col gap-2">
        <div className="text-sm font-medium">Bon de réception à envoyer au client</div>
        <PartagerLien
          url={publicUrl}
          titre={`Réception ${reception.numero ?? ""}`}
          texte="Voici l'accusé de réception de vos pièces, à vérifier et à signer."
        />
        {/* B6 — le module jantes a son bon de prise en charge, le thermolaquage courant non :
            même gabarit (pdf/jantes.tsx → pdf/styles.ts partagé), adapté à une réception simple. */}
        <a
          href={`/api/pdf/reception/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800 transition duration-150 ease-out hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <FileText size={16} aria-hidden /> Bon de prise en charge (PDF)
        </a>
      </Card>

      <div className="border-t border-gray-100 pt-4">
        <div className="mb-3 text-sm font-semibold text-gray-700">Modifier la réception</div>
        <ReceptionForm receptionId={id} onSaved={() => { toast("Réception enregistrée"); reload(); }} />
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        <div className="text-sm font-semibold text-gray-700">Réception saisie par erreur</div>
        <p className="text-xs text-gray-500">
          Elle quitte les listes et le lien envoyé au client cesse de répondre. Vous pouvez la
          restaurer pendant 30 jours.
        </p>
        <div>
          <BoutonCorbeille entite="reception" id={id} libelle={reception.numero ?? "Réception"} />
        </div>
      </div>
    </div>
  );
}
