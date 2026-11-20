"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellOff, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { useToast } from "@/components/Toast";
import { useAlertes } from "@/components/AlertesProvider";
import { Badge, Button, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { sortRelance } from "@/lib/alertes";
import { useTitreDocument } from "@/lib/titre";
import { dateHeureFr, eur } from "@/lib/utils";

/**
 * Le journal des relances : ce que le logiciel a écrit à vos clients, à qui, quand, et si le
 * message est bien parti.
 *
 * POURQUOI cet écran. Trois colonnes (`relances_actives`, `relance_count`, `derniere_relance_at`)
 * étaient écrites par le cron de 7 h et n'apparaissaient nulle part dans l'application. Un
 * logiciel qui écrit à vos clients sans que vous puissiez voir quoi est un logiciel qu'on
 * n'installe pas — c'est une question de confiance avant d'être une fonction.
 *
 * L'écran est fermé au rôle `atelier` par la RLS de `relances`, pas par une condition d'affichage :
 * la vue `relances_envoyees` est en `security_invoker`, elle ne rend simplement aucune ligne.
 */

type Ligne = {
  id: string;
  sent_at: string;
  document_type: "devis" | "facture";
  document_id: string;
  document_numero: string | null;
  client_id: string | null;
  client_nom: string | null;
  destinataire: string | null;
  destinataire_client: string | null;
  trace_disponible: boolean | null;
  montant_ttc: number | string | null;
  statut_envoi: string;
  erreur_envoi: string | null;
  document_relances_actives: boolean | null;
  client_relances_actives: boolean | null;
};

// D13 — `dateHeureFr` était redéfinie ici en `dateStyle: "long"`, et dans `ReglagesRelances.tsx`
// en `dateStyle: "short"` : même nom, même écran (l'historique des relances), deux rendus
// différents. La seule définition qui fait foi est désormais celle de `lib/utils.ts`.

export default function RelancesPage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const reglages = useAlertes();
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [busy, setBusy] = useState("");

  const charger = useCallback(async () => {
    // 200 lignes : à trois relances par document au maximum, c'est déjà plusieurs mois d'activité.
    // Au-delà, l'information utile n'est plus « qu'avons-nous envoyé » mais « à qui », et c'est la
    // fiche client qui répond.
    const { data } = await supabase
      .from("relances_envoyees")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(200);
    setLignes((data as Ligne[]) ?? []);
  }, [supabase]);

  useEffect(() => { charger(); }, [charger]);

  useTitreDocument("Relances");

  async function couperClient(clientId: string, nom: string | null) {
    setBusy(clientId);
    const ok = await ecrire(
      supabase.from("clients").update({ relances_actives: false }).eq("id", clientId),
      toast,
      `${nom ?? "Ce client"} ne sera plus jamais relancé automatiquement.`,
    );
    setBusy("");
    if (ok) await charger();
  }

  if (!lignes) return <Spinner />;

  const enEchec = lignes.filter((l) => l.statut_envoi === "error");
  // Les clients sortis de la file : l'exploitant doit pouvoir vérifier d'un coup d'œil que sa
  // demande a bien été prise en compte, et la défaire si c'était une erreur.
  const clientsCoupes = Array.from(
    new Map(
      lignes.filter((l) => l.client_relances_actives === false && l.client_id)
            .map((l) => [l.client_id!, l.client_nom]),
    ).entries(),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        action={
          <Link href="/reglages?onglet=alertes" className="text-sm text-brand underline underline-offset-2">
            Réglages
          </Link>
        }
      >
        Relances envoyées
      </PageTitle>

      <p className="-mt-2 text-sm text-gray-600">
        Tout ce que Thermogestion a écrit à vos clients en votre nom. Une relance part au plus tous
        les {reglages.relance_devis_jours} jours pour un devis, {reglages.relance_facture_jours} jours
        pour une facture, et {reglages.relance_max} fois au maximum par document.
      </p>

      {enEchec.length > 0 && (
        <Card className="border-danger bg-danger-light text-sm text-danger-dark">
          <b>{enEchec.length} message{enEchec.length > 1 ? "s" : ""} n&apos;{enEchec.length > 1 ? "ont" : "a"} pas pu être remis.</b>{" "}
          Vérifiez l&apos;adresse e-mail de ces clients : de leur point de vue, vous ne les avez jamais relancés.
        </Card>
      )}

      {clientsCoupes.length > 0 && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <BellOff size={15} aria-hidden /> Clients exclus des relances
          </div>
          <div className="flex flex-wrap gap-2">
            {clientsCoupes.map(([id, nom]) => (
              <Link key={id} href={`/clients/${id}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 underline underline-offset-2">
                {nom ?? "Client"}
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Aucun de leurs devis ni de leurs factures ne part en relance, quels que soient les
            réglages des documents. Rouvrez la fiche du client pour revenir dessus.
          </p>
        </Card>
      )}

      {lignes.length === 0 ? (
        <Empty icon={<Mail size={32} />}>
          Aucune relance n&apos;est encore partie. Thermogestion relance un devis resté sans réponse
          et une facture dépassant son échéance — vous verrez ici chaque message, son destinataire
          et son sort.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {lignes.map((l) => {
            const st = sortRelance(l);
            const coupe = l.client_relances_actives === false || l.document_relances_actives === false;
            return (
              <li key={l.id}>
                <Card className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      <Link
                        href={`/${l.document_type === "devis" ? "devis" : "factures"}/${l.document_id}`}
                        className="font-semibold underline underline-offset-2"
                      >
                        {l.document_numero ?? (l.document_type === "devis" ? "Devis" : "Facture")}
                      </Link>{" "}
                      <span className="text-gray-500">
                        · {l.client_nom ?? "client supprimé"}
                        {l.montant_ttc != null ? ` · ${eur(l.montant_ttc)} TTC` : ""}
                      </span>
                    </span>
                    <Badge tone={st.ton}>{st.badge}</Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    {dateHeureFr(l.sent_at)} · {st.destinataire}
                  </div>
                  {/* En clair, pas en infobulle : le journal des relances s'ouvre au téléphone,
                      un client en ligne, et un `title` ne se survole pas au doigt. */}
                  {st.explication && <div className="text-xs text-gray-500">{st.explication}</div>}
                  {l.erreur_envoi && <div className="text-xs text-danger">{l.erreur_envoi}</div>}
                  {coupe ? (
                    <div className="text-xs text-warning-dark">Les relances sont désormais coupées sur ce document.</div>
                  ) : (
                    l.client_id && (
                      <div>
                        <Button
                          variant="ghost"
                          className="px-0 text-xs"
                          loading={busy === l.client_id}
                          onClick={() => couperClient(l.client_id!, l.client_nom)}
                        >
                          Ne plus jamais relancer {l.client_nom ?? "ce client"}
                        </Button>
                      </div>
                    )
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
