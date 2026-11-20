"use client";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ConfirmModal from "@/components/Modal";
import PartagerLien from "@/components/PartagerLien";
import { Button, Card, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { accesCommercial, estRole, type Role } from "@/lib/roles";
import { urlPortail } from "@/lib/portail";
import { SITE_URL } from "@/lib/env";
// D13 — date et heure recomposées à la main ici (`toLocaleDateString` + `toLocaleTimeString`),
// un format de plus parmi ceux que la recette a relevés. `dateHeureFr` (lib/utils.ts) est
// désormais la seule façon d'afficher une date et son heure ensemble sur les écrans internes.
import { dateHeureFr } from "@/lib/utils";

type Portail = {
  jeton: string;
  ouvert_at: string;
  derniere_visite_at: string | null;
  visites: number;
};

/**
 * L'espace client, vu depuis l'atelier.
 *
 * Quatre gestes, et pas un de plus : ouvrir, envoyer le lien, le renouveler, le fermer. Le
 * portail est **fermé par défaut** — on n'ouvre pas l'historique commercial d'une entreprise
 * parce qu'un logiciel a coché une case à sa place.
 *
 * Le bloc n'apparaît qu'aux rôles qui voient déjà l'argent. Ce n'est pas de la cosmétique : le
 * jeton donne accès, par la porte publique, aux factures que la RLS refuse au rôle atelier par la
 * porte de service. La base applique la même règle (politique `portail_lecture_commerciale` et
 * garde `acces_commercial()` dans les trois fonctions) ; ici on évite seulement d'afficher un
 * bloc qui répondrait « non ».
 */
export default function PortailReglage({ clientId, clientNom }: { clientId: string; clientNom: string }) {
  const toast = useToast();
  const [role, setRole] = useState<Role | null | undefined>(undefined);
  const [portail, setPortail] = useState<Portail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [askRevoke, setAskRevoke] = useState(false);
  const [askRegen, setAskRegen] = useState(false);
  // L'URL doit porter le domaine réellement utilisé : un atelier qui travaille sur un nom de
  // domaine personnalisé ne doit pas envoyer à son client un lien vers l'adresse Vercel.
  const [base, setBase] = useState(SITE_URL);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: membre }, { data: p }] = await Promise.all([
      supabase.from("users").select("role").maybeSingle(),
      supabase
        .from("client_portail")
        .select("jeton, ouvert_at, derniere_visite_at, visites")
        .eq("client_id", clientId)
        .maybeSingle(),
    ]);
    setRole(estRole(membre?.role) ? membre.role : null);
    setPortail((p as Portail | null) ?? null);
  }, [clientId]);

  useEffect(() => {
    if (typeof window !== "undefined") setBase(window.location.origin);
    charger();
  }, [charger]);

  if (role === undefined || portail === undefined) return <Card><Spinner taille="sm" /></Card>;
  if (!accesCommercial(role)) return null;

  async function appeler(rpc: "portail_ouvrir" | "portail_regenerer" | "portail_revoquer", succes: string) {
    setBusy(true);
    const { error } = await createClient().rpc(rpc, { p_client: clientId });
    if (error) toast(errorFr(error), "error");
    else {
      toast(succes);
      await charger();
    }
    setBusy(false);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <KeyRound size={18} aria-hidden className="text-gray-500" />
        <h2 className="font-display text-base font-semibold text-gray-900">Espace client en ligne</h2>
      </div>

      {!portail ? (
        <>
          <p className="text-sm text-gray-600">
            Un lien unique, sans mot de passe, où {clientNom} retrouve <b>l&apos;avancement de ses
            pièces, ses devis à signer, ses bons de livraison et ses factures</b> — sans vous
            écrire. Il ne verra jamais vos prix de revient, vos notes internes, ni un autre client.
          </p>
          <p className="text-xs text-gray-500">
            L&apos;espace est fermé tant que vous ne l&apos;ouvrez pas, et vous pouvez le refermer
            à tout moment.
          </p>
          <div>
            <Button loading={busy} onClick={() => appeler("portail_ouvrir", "Espace client ouvert")}>
              Ouvrir l&apos;espace client
            </Button>
          </div>
        </>
      ) : (
        <>
          <PartagerLien
            url={urlPortail(base, portail.jeton)}
            titre={`Votre espace client — ${clientNom}`}
            texte="Suivez vos pièces et retrouvez vos documents à tout moment."
            libelleCopie="Copier le lien"
          />

          <p className="text-xs text-gray-500">
            {portail.derniere_visite_at
              ? `Dernière consultation : ${dateHeureFr(portail.derniere_visite_at)} · ${portail.visites} ouverture${portail.visites > 1 ? "s" : ""}.`
              : "Jamais consulté depuis l'envoi du lien — pensez à vérifier qu'il est bien arrivé."}
          </p>

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setAskRegen(true)} className="flex items-center gap-2">
              <RefreshCw size={16} aria-hidden /> Renouveler le lien
            </Button>
            <Button variant="danger" onClick={() => setAskRevoke(true)} className="flex items-center gap-2">
              <ShieldOff size={16} aria-hidden /> Fermer l&apos;espace
            </Button>
          </div>
        </>
      )}

      <ConfirmModal
        open={askRegen}
        title="Renouveler le lien ?"
        message={`Le lien actuel cessera immédiatement de fonctionner — y compris s'il est déjà dans la boîte mail de ${clientNom}. C'est ce qu'il faut faire si vous pensez qu'il a circulé.`}
        confirmLabel="Renouveler"
        busy={busy}
        onCancel={() => setAskRegen(false)}
        onConfirm={async () => {
          await appeler("portail_regenerer", "Nouveau lien créé — envoyez-le à votre client");
          setAskRegen(false);
        }}
      />

      <ConfirmModal
        open={askRevoke}
        title="Fermer l'espace client ?"
        message="Le lien cesse de fonctionner immédiatement. Rien n'est supprimé : vous pourrez rouvrir un espace plus tard, avec un nouveau lien."
        confirmLabel="Fermer l'espace"
        danger
        busy={busy}
        onCancel={() => setAskRevoke(false)}
        onConfirm={async () => {
          await appeler("portail_revoquer", "Espace client fermé");
          setAskRevoke(false);
        }}
      />
    </Card>
  );
}
