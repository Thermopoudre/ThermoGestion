"use client";
import { useState } from "react";
import { QrCode as QrIcon, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/Toast";
import QrCode from "@/components/QrCode";

/**
 * Envoi d'un lien public à un client.
 *
 * Avant : l'URL brute et un bouton « Copier ». Envoyer un bon de prise en charge au garage depuis
 * un téléphone demandait six gestes — copier, quitter l'application, ouvrir WhatsApp, choisir le
 * contact, coller, envoyer. `navigator.share` ouvre directement le sélecteur d'applications du
 * système ; il n'existe pas sur les navigateurs de bureau, d'où le repli sur la copie. Le QR sert
 * le cas du client présent au comptoir : il scanne, il repart avec le suivi dans son téléphone.
 */
export default function PartagerLien({
  url,
  titre,
  texte,
  libelleCopie = "Copier le lien",
}: {
  url: string;
  titre: string;
  texte: string;
  libelleCopie?: string;
}) {
  const toast = useToast();
  const [qr, setQr] = useState(false);

  async function partager() {
    // `navigator.share` exige un geste utilisateur et rejette avec AbortError si l'utilisateur
    // ferme le sélecteur : ce n'est pas une erreur à afficher.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: titre, text: texte, url });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    await copier();
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien copié");
    } catch {
      toast("Impossible de copier le lien — sélectionnez-le à la main.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="break-all rounded bg-gray-50 p-2 text-xs text-gray-600">{url}</div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={partager} className="flex flex-1 items-center justify-center gap-2">
          <Share2 size={16} aria-hidden /> Envoyer au client
        </Button>
        <Button variant="secondary" onClick={copier}>{libelleCopie}</Button>
        <Button variant="secondary" onClick={() => setQr((v) => !v)} aria-expanded={qr} className="flex items-center gap-2">
          <QrIcon size={16} aria-hidden /> {qr ? "Masquer" : "QR"}
        </Button>
      </div>
      {qr && (
        <div className="flex flex-col items-center gap-1">
          <QrCode value={url} />
          <p className="text-center text-xs text-gray-500">À faire scanner au client présent au comptoir.</p>
        </div>
      )}
    </div>
  );
}
