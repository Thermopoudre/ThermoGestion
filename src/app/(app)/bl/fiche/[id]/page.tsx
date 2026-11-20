"use client";
import { use, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BonLivraisonEditor from "@/components/BonLivraisonEditor";
import PartagerLien from "@/components/PartagerLien";
import EnvoyerDocument from "@/components/EnvoyerDocument";
import BoutonCorbeille from "@/components/BoutonCorbeille";
import { useToast } from "@/components/Toast";
import { Badge, Button, Card, Input, PageTitle, Spinner } from "@/components/ui";
import { useTitreDocument } from "@/lib/titre";
import { calcTotaux, dateFr, eur, nombreFr } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import { STATUS_BL } from "@/lib/types";
import type { BonLivraison } from "@/lib/types";

type BlAvecEmail = BonLivraison & { clients?: { nom: string; email: string | null } };

// La fiche vit sous /bl/fiche/<id> et non /bl/<id> : /bl/<token> est la page publique signée par
// le client, et deux routes dynamiques au même niveau se recouvrent (c'est la première déclarée
// qui gagne, donc le lien client tomberait sur l'écran atelier protégé par l'authentification).

export default function BlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [bl, setBl] = useState<BlAvecEmail | null>(null);
  const [busy, setBusy] = useState(false);
  const [recuPar, setRecuPar] = useState("");
  const toast = useToast();

  async function reload() {
    const { data } = await supabase.from("bons_livraison").select("*, clients(nom, email)").eq("id", id).single();
    setBl(data as unknown as BlAvecEmail);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useTitreDocument(bl ? `BL ${bl.numero ?? "brouillon"} — ${bl.clients?.nom ?? ""}` : null);

  if (!bl) return <Spinner />;

  // La remise doit entrer dans le calcul ici aussi : sans elle, l'atelier lirait sur sa fiche un
  // total différent de celui que son client voit sur la page publique du même bon.
  const totaux = calcTotaux(bl.lignes ?? [], bl.remise ?? null);
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/bl/${bl.public_token}` : "";
  const signature = bl.signature as { image?: string } | null;

  async function emettre() {
    setBusy(true);
    let numero = bl!.numero;
    if (!numero) {
      const { data } = await supabase.rpc("next_numero", { p_type: "bl" });
      numero = data as string;
    }
    const { error } = await supabase.from("bons_livraison").update({ status: "emis", numero }).eq("id", id);
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Bon de livraison émis — lien client prêt");
    await reload();
  }

  // Sortie de secours quand le client repart sans avoir signé sur le téléphone (mains sales,
  // pas de réseau dans l'atelier) : la livraison est actée manuellement par l'atelier.
  async function marquerLivre() {
    setBusy(true);
    const { error } = await supabase.from("bons_livraison").update({
      status: "livre",
      livre_at: new Date().toISOString(),
      recu_par: recuPar.trim() || null,
    }).eq("id", id);
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Livraison enregistrée");
    await reload();
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Badge tone={STATUS_BL[bl.status].ton}>{STATUS_BL[bl.status].label}</Badge>}>
        {bl.numero ?? "Brouillon"}
      </PageTitle>
      <div className="text-sm text-gray-500">
        Client : <b className="text-gray-800">{bl.clients?.nom}</b> · {eur(totaux.total_ttc)} TTC
        {bl.nb_colis ? ` · ${bl.nb_colis} colis` : ""}{bl.poids_kg ? ` · ${nombreFr(bl.poids_kg)} kg` : ""}
      </div>

      {bl.status === "brouillon" && (
        <Button taille="xl" onClick={emettre} loading={busy} disabled={(bl.lignes ?? []).length === 0}>
          Émettre le bon et générer le lien de signature
        </Button>
      )}

      {bl.status !== "brouillon" && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-medium">
            Lien client {bl.status === "emis" ? "— à faire signer à la remise des pièces" : "(consultation)"}
          </div>
          <PartagerLien
            url={publicUrl}
            titre={`Bon de livraison ${bl.numero ?? ""}`}
            texte="Voici votre bon de livraison, à vérifier et à signer à la remise des pièces."
          />
          <EnvoyerDocument
            type="bl"
            id={bl.id}
            clientEmail={bl.clients?.email ?? null}
            mailtoHref={`mailto:?subject=${encodeURIComponent(`Bon de livraison ${bl.numero ?? ""}`)}&body=${encodeURIComponent(`Bonjour,%0A%0AVoici votre bon de livraison : ${publicUrl}`)}`.replace(/%250A/g, "%0A")}
          />
        </Card>
      )}

      {bl.status === "emis" && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Le client ne peut pas signer sur son téléphone ?</div>
          <p className="text-xs text-gray-500">
            Ouvrez le lien ci-dessus sur votre propre appareil et faites-le signer, ou actez la
            livraison ici.
          </p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input placeholder="Nom de la personne qui emporte les pièces" value={recuPar} onChange={(e) => setRecuPar(e.target.value)} />
            <Button variant="secondary" onClick={marquerLivre} disabled={busy}>Livré</Button>
          </div>
        </Card>
      )}

      {bl.status === "livre" && (
        <Card className="flex flex-col gap-2 border-green-300 bg-green-50">
          <div className="text-sm font-semibold text-green-800">
            Livré{bl.livre_at ? ` le ${dateFr(bl.livre_at)}` : ""}{bl.recu_par ? ` — reçu par ${bl.recu_par}` : ""}
          </div>
          {signature?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signature.image} alt="Signature du client" className="h-24 w-full rounded bg-white object-contain" />
          )}
          <p className="text-xs text-green-700">Ce bon peut maintenant être facturé.</p>
        </Card>
      )}

      {bl.status === "facture" && (
        <Card className="text-sm text-gray-600">Ce bon de livraison a été facturé.</Card>
      )}

      {bl.note && (
        <Card>
          <div className="mb-1 text-sm font-semibold">Note de livraison</div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{bl.note}</p>
        </Card>
      )}

      <BonLivraisonEditor blId={id} onSaved={() => { toast("Bon enregistré"); reload(); }} />

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        <div className="text-sm font-semibold text-gray-700">Bon créé par erreur</div>
        <p className="text-xs text-gray-500">
          Un bon déjà porté par une facture ne peut pas partir à la corbeille : la base refusera,
          et c&apos;est ce qui empêche une double facturation par la petite porte.
        </p>
        <div>
          <BoutonCorbeille entite="bl" id={id} libelle={bl.numero ?? "Brouillon"} />
        </div>
      </div>
    </div>
  );
}
