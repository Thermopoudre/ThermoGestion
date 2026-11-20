"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { Badge, Button, Card, Empty, Input, PageTitle, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { lienPanierBoutique } from "@/lib/thermopoudre/fiche";
import { useTitreDocument } from "@/lib/titre";
import { dateFr, eur } from "@/lib/utils";
import type { CommandePoudre, CommandePoudreLigne, Poudre } from "@/lib/types";

/**
 * Réapprovisionnement de poudre.
 *
 * Le panier est en base, pas dans le navigateur : le réappro se prépare au fil de la semaine,
 * souvent depuis le téléphone devant la cabine, et se valide depuis le bureau.
 *
 * L'envoi produit un **bon de commande par mail** et non une commande créée directement dans la
 * boutique : le webservice PrestaShop permettrait de poser une commande, mais il faudrait lui
 * fournir nous-mêmes les totaux, le port et la remise du compte client — c'est-à-dire fabriquer un
 * prix qui n'est pas celui de la boutique. Un bon de commande que le fournisseur chiffre lui-même
 * est plus juste, et c'est ainsi que commandent les ateliers. Le lien « panier boutique » reste là
 * pour qui préfère payer en ligne tout de suite.
 */

const EMAIL_FOURNISSEUR_DEFAUT = "contact@thermopoudre.fr";

type Lignes = Record<string, CommandePoudreLigne[]>;

export default function CommandesPage() {
  const supabase = createClient();
  const toast = useToast();
  const [commandes, setCommandes] = useState<CommandePoudre[] | null>(null);
  const [lignes, setLignes] = useState<Lignes>({});
  const [poudres, setPoudres] = useState<Poudre[]>([]);
  const [emailFournisseur, setEmailFournisseur] = useState(EMAIL_FOURNISSEUR_DEFAUT);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [ajoutPoudre, setAjoutPoudre] = useState("");
  const [ajoutQte, setAjoutQte] = useState("20");

  const charger = useCallback(async () => {
    const [{ data: cmds }, { data: lgs }, { data: pds }] = await Promise.all([
      supabase.from("commandes_poudre").select("*").order("created_at", { ascending: false }),
      supabase.from("commande_poudre_lignes").select("*").order("reference"),
      supabase.from("poudres").select("*").eq("actif", true).order("reference"),
    ]);
    const parCommande: Lignes = {};
    for (const l of (lgs as CommandePoudreLigne[]) ?? []) {
      (parCommande[l.commande_id] ??= []).push(l);
    }
    setCommandes((cmds as CommandePoudre[]) ?? []);
    setLignes(parCommande);
    setPoudres((pds as Poudre[]) ?? []);
    const panier = ((cmds as CommandePoudre[]) ?? []).find((c) => c.status === "panier");
    if (panier) setNote(panier.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  useTitreDocument("Commandes de poudre");

  if (!commandes) return <Spinner />;

  const panier = commandes.find((c) => c.status === "panier") ?? null;
  const lignesPanier = panier ? lignes[panier.id] ?? [] : [];
  const historique = commandes.filter((c) => c.status !== "panier");
  const totalPanier = lignesPanier.reduce((s, l) => s + Number(l.quantite_kg) * Number(l.prix_kg ?? 0), 0);

  async function ajouter() {
    if (!ajoutPoudre) return;
    const qte = Number(ajoutQte.replace(",", "."));
    if (!(qte > 0)) { toast("Indiquez une quantité en kilos.", "error"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("ajouter_au_panier_poudre", { p_poudre_id: ajoutPoudre, p_quantite_kg: qte });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setAjoutPoudre("");
    toast("Ajouté au panier de réapprovisionnement.");
    charger();
  }

  async function changerQte(ligne: CommandePoudreLigne, valeur: string) {
    const qte = Number(valeur.replace(",", "."));
    if (!(qte > 0)) return;
    const { error } = await supabase.from("commande_poudre_lignes").update({ quantite_kg: qte }).eq("id", ligne.id);
    if (error) { toast(errorFr(error), "error"); return; }
    charger();
  }

  async function retirer(ligne: CommandePoudreLigne) {
    const { error } = await supabase.from("commande_poudre_lignes").delete().eq("id", ligne.id);
    if (error) { toast(errorFr(error), "error"); return; }
    charger();
  }

  async function envoyer() {
    if (!panier || lignesPanier.length === 0) return;
    setBusy(true);
    // La note part sur le bon de commande : la perdre en silence, c'est envoyer au fournisseur
    // un bon amputé de la seule consigne que l'atelier a pris la peine d'écrire.
    if (!(await ecrire(supabase.from("commandes_poudre").update({ note: note || null }).eq("id", panier.id), toast))) { setBusy(false); return; }
    const { data, error } = await supabase.rpc("envoyer_commande_poudre", {
      p_commande: panier.id,
      p_email_fournisseur: emailFournisseur,
    });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setNote("");
    toast(`Bon de commande ${data} envoyé à ${emailFournisseur}.`);
    charger();
  }

  async function receptionner(cmd: CommandePoudre) {
    const l = lignes[cmd.id] ?? [];
    const sansPoudre = l.filter((x) => !x.poudre_id);
    if (sansPoudre.length > 0) {
      toast("Une ligne n'est plus rattachée à une poudre du stock : recréez-la avant de réceptionner.", "error");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("receptionner_commande_poudre", {
      p_commande: cmd.id,
      p_lignes: l.map((x) => ({ ligne_id: x.id, quantite_kg: Number(x.quantite_kg) })),
    });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Réception enregistrée : les lots sont créés et le stock est à jour.");
    charger();
  }

  const dejaAuPanier = new Set(lignesPanier.map((l) => l.poudre_id));

  return (
    <div className="flex flex-col gap-3">
      <PageTitle action={<Link href="/stock" className="text-sm font-medium text-brand">Stock →</Link>}>
        Commandes de poudre
      </PageTitle>

      <Card>
        <div className="mb-2 text-sm font-semibold">Panier de réapprovisionnement</div>

        {lignesPanier.length === 0 ? (
          <Empty>
            Le panier est vide. Ajoutez une teinte ci-dessous, ou partez des alertes de seuil depuis
            l&apos;écran Stock.
          </Empty>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {lignesPanier.map((l) => (
              <div key={l.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.reference}</div>
                  <div className="truncate text-xs text-gray-500">{l.designation}</div>
                  {l.tp_product_id && (
                    <a
                      href={lienPanierBoutique(l.tp_product_id, Number(l.quantite_kg))}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand underline"
                    >
                      Mettre au panier sur thermopoudre.fr →
                    </a>
                  )}
                </div>
                <div className="w-24 shrink-0">
                  <Input
                    type="number"
                    aria-label={`Quantité en kilos pour ${l.reference}`}
                    defaultValue={String(l.quantite_kg)}
                    onBlur={(e) => changerQte(l, e.target.value)}
                  />
                </div>
                <span className="w-8 shrink-0 text-xs text-gray-500">kg</span>
                <button
                  type="button"
                  onClick={() => retirer(l)}
                  aria-label={`Retirer ${l.reference}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-gray-400 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Ajouter une teinte</span>
            <select
              value={ajoutPoudre}
              onChange={(e) => setAjoutPoudre(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white min-h-[44px] px-3 py-3 text-sm focus:border-brand focus:outline-none"
            >
              <option value="">Choisir…</option>
              {poudres.map((p) => (
                <option key={p.id} value={p.id} disabled={dejaAuPanier.has(p.id)}>
                  {p.reference}
                  {p.ral ? ` · RAL ${p.ral}` : ""}
                  {dejaAuPanier.has(p.id) ? " (déjà au panier)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="w-28">
            <Input label="Quantité (kg)" type="number" value={ajoutQte} onChange={(e) => setAjoutQte(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={ajouter} disabled={busy || !ajoutPoudre}>Ajouter</Button>
        </div>

        {lignesPanier.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            {totalPanier > 0 && (
              <p className="mb-2 text-sm">
                Estimation : <b>{eur(totalPanier)} HT</b>{" "}
                <span className="text-xs text-gray-500">
                  — d&apos;après les prix au kilo enregistrés dans votre stock. Le prix qui fait foi est celui du fournisseur.
                </span>
              </p>
            )}
            <Textarea
              label="Note pour le fournisseur"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : livraison avant vendredi, laisser au portail si absent."
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input
                label="Adresse du fournisseur"
                type="email"
                value={emailFournisseur}
                onChange={(e) => setEmailFournisseur(e.target.value)}
              />
              <Button onClick={envoyer} disabled={busy}>Envoyer le bon de commande</Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Le bon de commande part par mail avec vos coordonnées de livraison, et vous en recevez une copie.
            </p>
          </div>
        )}
      </Card>

      {historique.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <h2 className="mt-2 text-sm font-semibold text-gray-600">Historique</h2>
          {historique.map((c) => {
            const l = lignes[c.id] ?? [];
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{c.numero}</div>
                    <div className="text-xs text-gray-500">
                      {c.status === "recue"
                        ? `Reçue le ${dateFr(c.recue_at)}`
                        : `Envoyée le ${dateFr(c.envoyee_at)} à ${c.fournisseur_email ?? c.fournisseur}`}
                    </div>
                  </div>
                  <Badge tone={c.status === "recue" ? "success" : "info"}>
                    {c.status === "recue" ? "Reçue" : "Envoyée"}
                  </Badge>
                </div>
                <ul className="mt-2 text-sm text-gray-700">
                  {l.map((x) => (
                    <li key={x.id} className="flex justify-between gap-3">
                      <span className="truncate">{x.reference}</span>
                      <span className="shrink-0 text-gray-500">
                        {Number(x.quantite_kg)} kg
                        {x.recue_kg != null && Number(x.recue_kg) !== Number(x.quantite_kg) ? ` (reçu ${Number(x.recue_kg)})` : ""}
                        {x.lot_numero ? ` · lot ${x.lot_numero}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {c.status === "envoyee" && (
                  <div className="mt-3">
                    <Button variant="secondary" onClick={() => receptionner(c)} disabled={busy}>
                      Marquer reçue et entrer en stock
                    </Button>
                    <p className="mt-1 text-xs text-gray-500">
                      Un lot est créé par ligne, avec le numéro du bon de commande. Vous pourrez corriger
                      le numéro de lot et la DLU depuis la fiche du lot.
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
