"use client";
import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { dateFr } from "@/lib/utils";

type TypeDocument = "devis" | "facture" | "bl";

type Trace = {
  destinataire: string;
  statut_envoi: string;
  erreur_envoi: string | null;
  envoye_at: string;
};

const LIBELLE: Record<TypeDocument, string> = {
  devis: "le devis",
  facture: "la facture",
  bl: "le bon de livraison",
};

const STATUT_LIBELLE: Record<string, string> = {
  sent: "parti",
  pending: "en file d'attente (quelques minutes)",
  error: "échec",
  annulee: "non transmis",
};

/**
 * B1 — remplace le `mailto:` des trois fiches (devis/[id], factures/[id], bl/fiche/[id]) par un
 * envoi réellement tracé : PDF en pièce jointe (route serveur, B3), expéditeur = l'atelier (B2),
 * et une ligne dans `notifications` que `envois_documents` rend lisible ici même après coup —
 * c'est la trace demandée par le cahier des charges. Le `mailto:` ne reste que si le client n'a
 * strictement aucune adresse enregistrée : dès qu'on peut taper une adresse à la main, ce repli
 * disparaît au profit de l'envoi tracé.
 */
export default function EnvoyerDocument({
  type,
  id,
  clientEmail,
  mailtoHref,
}: {
  type: TypeDocument;
  id: string;
  clientEmail: string | null;
  /** Le seul repli qui reste : un `mailto:` déjà construit (sujet + corps), affiché uniquement
   *  quand le client n'a pas d'adresse enregistrée. */
  mailtoHref: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [destinataire, setDestinataire] = useState(clientEmail ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [ouvertMessage, setOuvertMessage] = useState(false);

  // Le client peut avoir été renseigné après l'ouverture de la fiche (onglet resté ouvert) :
  // on ne réécrit pas par-dessus une saisie manuelle déjà commencée.
  useEffect(() => {
    setDestinataire((d) => (d ? d : clientEmail ?? ""));
  }, [clientEmail]);

  async function chargerTrace() {
    const { data } = await supabase
      .from("envois_documents")
      .select("destinataire, statut_envoi, erreur_envoi, envoye_at")
      .eq("document_type", type)
      .eq("document_id", id)
      .order("envoye_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setTrace((data as Trace | null) ?? null);
  }
  useEffect(() => {
    chargerTrace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  async function envoyer() {
    const dest = destinataire.trim();
    if (!dest) {
      toast("Indiquez une adresse e-mail.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/notifications/envoyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, destinataire: dest, message: message.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (!res.ok) {
        toast((data.error as string) ?? "Impossible d'envoyer ce document.", "error");
        return;
      }
      if (data.dejaEnvoye) {
        toast("Déjà envoyé à l'instant — pas de second message parti.");
      } else if (data.pdfJoint === false) {
        toast(`Envoi lancé vers ${dest} — le PDF n'a pas pu être joint, le lien suffira au client.`);
      } else {
        toast(`Envoi lancé vers ${dest}, PDF joint.`);
      }
      setMessage("");
      setOuvertMessage(false);
      await chargerTrace();
    } catch {
      toast("Problème de connexion. Vérifiez votre réseau et réessayez.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        label="Destinataire"
        type="email"
        value={destinataire}
        onChange={(e) => setDestinataire(e.target.value)}
        placeholder="client@exemple.fr"
      />
      {ouvertMessage ? (
        <Textarea
          label="Un mot pour le client (facultatif)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ex. : voici le document dont nous avons parlé, n'hésitez pas si vous avez des questions."
        />
      ) : (
        <button
          type="button"
          onClick={() => setOuvertMessage(true)}
          className="self-start rounded text-xs font-medium text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          + Ajouter un mot personnalisé
        </button>
      )}
      <Button taille="xl" onClick={envoyer} loading={busy} disabled={!destinataire.trim()} className="flex items-center justify-center gap-2">
        <Send size={18} aria-hidden /> Envoyer {LIBELLE[type]} par e-mail
      </Button>
      {!clientEmail && (
        <p className="text-xs text-gray-500">
          Ce client n&apos;a pas d&apos;adresse enregistrée : tapez-en une ci-dessus, ou{" "}
          <a href={mailtoHref} className="underline underline-offset-2">
            écrivez depuis votre propre messagerie
          </a>
          .
        </p>
      )}
      {trace && (
        <p className="text-xs text-gray-500">
          Dernier envoi : {trace.destinataire}, {dateFr(trace.envoye_at)} — {STATUT_LIBELLE[trace.statut_envoi] ?? trace.statut_envoi}
          {trace.statut_envoi === "error" && trace.erreur_envoi ? ` (${trace.erreur_envoi})` : ""}.
        </p>
      )}
    </div>
  );
}
