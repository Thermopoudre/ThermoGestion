"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, PageTitle, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { usePlan } from "@/components/PlanProvider";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { FichierIllisible, lireFichier, type Feuille } from "@/lib/import/tableur";
import {
  MODELES, cleDoublon, deviner, normaliser, preparer,
  type LigneRejetee, type Modele, type Referentiels,
} from "@/lib/import/modeles";

/**
 * Reprise de l'Excel d'un atelier qui migre.
 *
 * Quatre temps, dans cet ordre : on choisit ce qu'on importe, on dépose le fichier, on vérifie la
 * correspondance des colonnes, et on regarde ce qui passera avant que quoi que ce soit ne soit
 * écrit. C'est l'aperçu qui compte : un import qui écrit d'abord et explique ensuite oblige à
 * nettoyer la base à la main.
 *
 * Depuis le lot A, deux modèles n'écrivent plus en insertion directe mais par une RPC réservée au
 * responsable — une facture émise et un lot de stock ne se posent pas par un `insert`. Ceux-là
 * partent ligne à ligne : une facture refusée ne doit pas emporter les vingt-deux autres, et son
 * motif de refus vient de la base, en français.
 */

type Etape = "fichier" | "correspondance" | "termine";

/** L'ordre de reprise, écrit à l'écran : un tarif négocié a besoin d'un client qui existe. */
const ORDRE_CONSEILLE = ["clients", "prestations", "poudres", "grille_m2", "tarifs_negocies", "lots_poudre", "factures_ouvertes"];

export default function ImportPage() {
  const supabase = createClient();
  const toast = useToast();
  const { estProprietaire } = usePlan();
  const [modele, setModele] = useState<Modele>(MODELES[0]);
  const [etape, setEtape] = useState<Etape>("fichier");
  const [feuille, setFeuille] = useState<Feuille | null>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [correspondance, setCorrespondance] = useState<Record<string, number | null>>({});
  const [deja, setDeja] = useState<Set<string>>(new Set());
  const [referentiels, setReferentiels] = useState<Referentiels>({});
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const [bilan, setBilan] = useState<{ inseres: number; rejets: LigneRejetee[] } | null>(null);
  // Les politiques RLS exigent `atelier_id` à l'insertion : PostgREST ne le déduit pas de la session.
  const [atelierId, setAtelierId] = useState<string | null>(null);
  /** Grille par défaut de l'atelier : c'est elle que le modèle « Grille m² » complète. */
  const [grilleDefautId, setGrilleDefautId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: grille }] = await Promise.all([
        supabase.from("users").select("atelier_id").maybeSingle(),
        supabase.from("grilles_tarifaires").select("id").eq("is_default", true).maybeSingle(),
      ]);
      setAtelierId(membre?.atelier_id ?? null);
      setGrilleDefautId(grille?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Référentiels de rapprochement.
   *
   * Deux fiches au même nom normalisé donnent une entrée `null` : on refuse la ligne plutôt que
   * d'attribuer un tarif négocié au mauvais « Martin ». Les prestations se rapprochent d'abord par
   * leur code — c'est ce que porte le tableur d'un atelier — puis par leur nom.
   */
  async function chargerReferentiels(m: Modele): Promise<Referentiels> {
    const besoins = new Set((m.rapprochements ?? []).map((r) => r.referentiel));
    const out: Referentiels = {};
    if (besoins.has("clients")) {
      const { data } = await supabase.from("clients").select("id, nom").is("deleted_at", null);
      out.clients = indexer((data ?? []) as { id: string; nom: string }[], (r) => [r.nom]);
    }
    if (besoins.has("prestations")) {
      const { data } = await supabase.from("prestations").select("id, code, nom");
      out.prestations = indexer((data ?? []) as { id: string; code: string | null; nom: string }[], (r) => [r.code ?? "", r.nom]);
    }
    if (besoins.has("poudres")) {
      const { data } = await supabase.from("poudres").select("id, reference, marque");
      out.poudres = indexer((data ?? []) as { id: string; reference: string; marque: string | null }[], (r) => [
        r.reference,
        `${r.marque ?? ""} ${r.reference}`,
      ]);
    }
    return out;
  }

  /** Ce qui existe déjà dans l'atelier, sous la forme exacte de la clé de doublon du modèle. */
  async function chargerDeja(m: Modele): Promise<Set<string>> {
    let requete = supabase.from(m.table).select(m.cleUnicite.join(", "));
    // La grille au m² n'est pas globale à l'atelier : ses paliers appartiennent à une grille.
    if (m.grilleDefaut && grilleDefautId) requete = requete.eq("grille_id", grilleDefautId);
    const { data } = await requete;
    return new Set(((data ?? []) as unknown as Record<string, unknown>[]).map((r) => cleDoublon(m, r)));
  }

  async function choisirFichier(f: File | null) {
    if (!f) return;
    setErreur("");
    setBilan(null);
    try {
      const lu = await lireFichier(f);
      const [refs, presents] = await Promise.all([chargerReferentiels(modele), chargerDeja(modele)]);
      setReferentiels(refs);
      setDeja(presents);
      setFeuille(lu);
      setNomFichier(f.name);
      setCorrespondance(deviner(lu.entetes, modele));
      setEtape("correspondance");
    } catch (e) {
      setErreur(e instanceof FichierIllisible ? e.message : "Ce fichier n'a pas pu être lu. Essayez un export CSV.");
    }
  }

  function changerModele(cle: string) {
    setModele(MODELES.find((m) => m.cle === cle) ?? MODELES[0]);
    setFeuille(null);
    setEtape("fichier");
    setBilan(null);
    setErreur("");
    setReferentiels({});
  }

  const apercu = feuille ? preparer(modele, feuille.lignes, correspondance, deja, referentiels) : null;
  const refuseAuRole = !!modele.proprietaire && !estProprietaire;
  const grilleManquante = !!modele.grilleDefaut && !grilleDefautId;

  async function importer() {
    if (!apercu || apercu.valides.length === 0 || !atelierId) return;
    setBusy(true);
    const rejets = [...apercu.rejets];
    let inseres = 0;

    if (modele.rpc) {
      /**
       * Écriture ligne à ligne. Une facture antérieure refusée par la base (numéro déjà pris,
       * totaux incohérents, reprise déjà close) ne doit pas emporter le reste du fichier : son
       * motif rejoint le rapport de rejet, avec le numéro de ligne du tableur de l'atelier.
       */
      for (let i = 0; i < apercu.valides.length; i++) {
        const ligne = apercu.valides[i];
        const { error } = await supabase.rpc(modele.rpc.nom, modele.rpc.parametres(ligne));
        if (error) {
          rejets.push({
            numero: apercu.sources[i],
            valeur: String(ligne[modele.temoin] ?? ""),
            motif: errorFr(error),
          });
          continue;
        }
        inseres++;
      }
    } else {
      // Par paquets : un atelier qui migre arrive parfois avec plusieurs centaines de lignes, et
      // une seule requête géante se fait couper par la passerelle sans message utile.
      const aInserer = apercu.valides.map((v) => ({
        ...retirerLibellesRapproches(modele, v),
        atelier_id: atelierId,
        ...(modele.grilleDefaut && grilleDefautId ? { grille_id: grilleDefautId } : {}),
      }));
      const paquets: Record<string, unknown>[][] = [];
      for (let i = 0; i < aInserer.length; i += 100) paquets.push(aInserer.slice(i, i + 100));

      for (const paquet of paquets) {
        /**
         * `poudres.prix_kg` n'est plus une colonne de la table : le prix d'achat vit dans
         * `poudre_couts`, fermée au rôle atelier. On le retire du paquet avant l'insertion — sinon
         * PostgREST refuse tout le lot pour une colonne inconnue — puis on le repose ligne à ligne
         * sur les identifiants rendus, qui reviennent dans l'ordre d'envoi.
         */
        const prix = modele.table === "poudres" ? paquet.map((l) => l.prix_kg ?? null) : null;
        const aEnvoyer = prix
          ? paquet.map((l) => {
              const { prix_kg: _ignore, ...reste } = l as Record<string, unknown> & { prix_kg?: unknown };
              return reste;
            })
          : paquet;

        const { error, data } = await supabase.from(modele.table).insert(aEnvoyer).select("id");
        if (error) {
          setBusy(false);
          toast(errorFr(error), "error");
          return;
        }
        inseres += data?.length ?? paquet.length;

        if (prix && data) {
          const couts = (data as { id: string }[])
            .map((ligne, i) => ({ poudre_id: ligne.id, atelier_id: atelierId, prix_kg: prix[i] }))
            .filter((c) => c.prix_kg != null);
          // Un prix refusé (rôle sans droit commercial) n'annule pas l'import : les fiches poudre
          // sont utiles sans leur prix d'achat, l'inverse ne l'est pas.
          if (couts.length > 0) await supabase.from("poudre_couts").upsert(couts);
        }
      }
    }

    setBusy(false);
    setBilan({ inseres, rejets });
    setEtape("termine");
    if (inseres > 0) toast(`${inseres} ligne${inseres > 1 ? "s" : ""} importée${inseres > 1 ? "s" : ""}.`);
    else toast("Aucune ligne n'a été importée.", "error");
  }

  function telechargerModele() {
    const entetes = modele.champs.map((c) => c.libelle).join(";");
    const exemple = modele.champs
      .map((c) => (c.type === "nombre" ? "0" : c.type === "date" ? "31/12/2026" : c.choix ? c.choix[0] : ""))
      .join(";");
    // BOM UTF-8 : sans lui, Excel en français ouvre « Société » en « SociÃ©tÃ© ».
    const blob = new Blob([`﻿${entetes}\n${exemple}\n`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `modele-import-${modele.cle}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const colonnesVues = modele.champs.filter((c) => correspondance[c.cle] != null);

  // Reliquat vague 3 — cette page n'avait jamais posé son titre d'onglet (ni au chargement direct,
  // via `metadata` côté `page.tsx`, ni après montage) : elle gardait le titre générique de l'app.
  useTitreDocument("Importer vos données");

  return (
    <div className="flex flex-col gap-3 md:max-w-3xl">
      <PageTitle
        action={
          <Link
            href={modele.ongletReglages ? `/reglages?onglet=${modele.ongletReglages}` : "/reglages"}
            className="text-sm font-medium text-brand"
          >
            Réglages →
          </Link>
        }
      >
        Importer vos données
      </PageTitle>

      <Card>
        <Select label="Que voulez-vous importer ?" value={modele.cle} onChange={(e) => changerModele(e.target.value)}>
          {ORDRE_CONSEILLE.map((cle) => MODELES.find((m) => m.cle === cle)).filter((m): m is Modele => !!m).map((m) => (
            <option key={m.cle} value={m.cle}>{m.libelle}</option>
          ))}
        </Select>
        <p className="mt-2 text-sm text-gray-600">{modele.description}</p>
        <p className="mt-2 text-xs text-gray-500">
          L&apos;ordre de la liste est l&apos;ordre à suivre : un tarif négocié a besoin d&apos;un client et
          d&apos;une prestation qui existent, un lot a besoin de sa poudre, une facture a besoin de son client.
        </p>
        <button type="button" onClick={telechargerModele} className="mt-2 text-sm font-medium text-brand underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          Télécharger un modèle de fichier
        </button>
      </Card>

      {modele.avertissement && (
        <Card className="border-warning/40 bg-warning-light/40">
          <div className="text-sm font-semibold text-warning-dark">À savoir avant d&apos;importer</div>
          <p className="mt-1 text-xs leading-relaxed text-gray-700">{modele.avertissement}</p>
        </Card>
      )}

      {refuseAuRole && (
        <Card className="border-danger/40 bg-danger-light/40">
          <p className="text-sm text-gray-800">
            Cet import crée des pièces comptables : il est réservé au responsable de l&apos;atelier.
            Demandez-lui de le faire, ou de vous passer responsable depuis Réglages → Équipe.
          </p>
        </Card>
      )}

      {grilleManquante && (
        <Card className="border-warning/40 bg-warning-light/40">
          <p className="text-sm text-gray-800">
            Vous n&apos;avez pas encore de grille tarifaire.{" "}
            <Link href="/reglages?onglet=grille" className="font-medium text-brand underline">Créez-la d&apos;abord</Link>{" "}
            : les paliers importés viennent s&apos;y ranger.
          </p>
        </Card>
      )}

      {etape === "fichier" && (
        <Card>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Fichier CSV ou Excel (.xlsx)</span>
            <input
              type="file"
              accept=".csv,.xlsx,.txt,text/csv"
              disabled={refuseAuRole || grilleManquante}
              onChange={(e) => choisirFichier(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-3 file:text-sm file:font-medium file:text-white disabled:opacity-50"
            />
          </label>
          <p className="mt-2 text-xs text-gray-500">
            La première ligne doit porter les intitulés de colonnes. Seule la première feuille du
            classeur est lue. Rien n&apos;est enregistré avant votre validation.
          </p>
          {erreur && <p className="mt-2 text-sm text-danger">{erreur}</p>}
        </Card>
      )}

      {etape === "correspondance" && feuille && apercu && (
        <>
          <Card>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Correspondance des colonnes</div>
              <button type="button" onClick={() => { setEtape("fichier"); setFeuille(null); }} className="text-xs text-gray-500 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                Changer de fichier
              </button>
            </div>
            <p className="mb-3 text-xs text-gray-500">
              {nomFichier} · {feuille.lignes.length} ligne{feuille.lignes.length > 1 ? "s" : ""}. Les colonnes
              reconnues sont pré-remplies, corrigez celles qui manquent.
            </p>
            <div className="flex flex-col gap-2">
              {modele.champs.map((c) => (
                <div key={c.cle} className="grid grid-cols-[1fr_1fr] items-center gap-2">
                  <div className="text-sm">
                    {c.libelle}
                    {c.obligatoire && <span className="text-danger"> *</span>}
                    {c.aide && <div className="text-xs text-gray-500">{c.aide}</div>}
                  </div>
                  <select
                    aria-label={`Colonne du fichier pour ${c.libelle}`}
                    value={correspondance[c.cle] ?? ""}
                    onChange={(e) =>
                      setCorrespondance({ ...correspondance, [c.cle]: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm focus:border-brand focus:outline-none"
                  >
                    <option value="">— ignorer —</option>
                    {feuille.entetes.map((e, i) => (
                      <option key={i} value={i}>{e || `Colonne ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-2 text-sm font-semibold">
              Aperçu — {apercu.valides.length} ligne{apercu.valides.length > 1 ? "s" : ""} sera importée
              {apercu.rejets.length > 0 && `, ${apercu.rejets.length} rejetée${apercu.rejets.length > 1 ? "s" : ""}`}
            </div>

            {apercu.valides.length > 0 && (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-300">
                      {colonnesVues.map((c) => (
                        <th key={c.cle} className="whitespace-nowrap px-2 py-1 font-medium text-gray-500">{c.libelle}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apercu.valides.slice(0, 5).map((v, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {colonnesVues.map((c) => (
                          <td key={c.cle} className="whitespace-nowrap px-2 py-1">{String(v[c.cle] ?? "—")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {apercu.valides.length > 5 && (
                  <p className="mt-1 text-xs text-gray-400">…et {apercu.valides.length - 5} autres.</p>
                )}
              </div>
            )}

            {apercu.rejets.length > 0 && <RapportRejets rejets={apercu.rejets} />}

            <Button
              className="mt-3"
              loading={busy}
              onClick={importer}
              disabled={apercu.valides.length === 0 || !atelierId || refuseAuRole}
            >
              Importer {apercu.valides.length} ligne{apercu.valides.length > 1 ? "s" : ""}
            </Button>
          </Card>
        </>
      )}

      {etape === "termine" && bilan && (
        <Card>
          <div className={`flex items-center gap-1.5 text-sm font-semibold ${bilan.inseres > 0 ? "text-success-dark" : "text-danger"}`}>
            {bilan.inseres > 0 ? (
              <>
                <Check size={16} aria-hidden className="flex-none" />
                {bilan.inseres} ligne{bilan.inseres > 1 ? "s" : ""} importée{bilan.inseres > 1 ? "s" : ""} dans {modele.libelle.toLowerCase()}
              </>
            ) : (
              "Aucune ligne n'a été importée."
            )}
          </div>
          {bilan.rejets.length > 0 && (
            <div className="mt-3">
              <RapportRejets rejets={bilan.rejets} />
              <p className="mt-2 text-xs text-gray-500">
                Corrigez ces lignes dans votre fichier puis relancez l&apos;import : les lignes déjà
                importées seront reconnues et ignorées.
              </p>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Link href={modele.voir} className="rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white">
              Voir le résultat
            </Link>
            <Button variant="secondary" onClick={() => { setEtape("fichier"); setFeuille(null); setBilan(null); }}>
              Importer un autre fichier
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Index de rapprochement : libellé normalisé → identifiant, `null` quand deux fiches se disputent
 * le même libellé. Un tarif négocié attribué au mauvais « Martin » ne se voit pas, et il chiffre
 * tous ses devis à côté.
 */
function indexer<T extends { id: string }>(lignes: T[], libelles: (l: T) => string[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const l of lignes) {
    for (const brut of libelles(l)) {
      const cle = normaliser(brut);
      if (cle === "") continue;
      if (out.has(cle) && out.get(cle) !== l.id) out.set(cle, null);
      else if (!out.has(cle)) out.set(cle, l.id);
    }
  }
  return out;
}

/** Les libellés rapprochés ne sont pas des colonnes de la table : seul l'identifiant l'est. */
function retirerLibellesRapproches(modele: Modele, ligne: Record<string, unknown>): Record<string, unknown> {
  if (!modele.rapprochements?.length) return ligne;
  const aRetirer = new Set(modele.rapprochements.map((r) => r.champ));
  return Object.fromEntries(Object.entries(ligne).filter(([k]) => !aRetirer.has(k)));
}

function RapportRejets({ rejets }: { rejets: LigneRejetee[] }) {
  function telecharger() {
    const lignes = ["Ligne;Valeur;Motif du rejet", ...rejets.map((r) => `${r.numero};"${r.valeur.replace(/"/g, '""')}";"${r.motif}"`)];
    const blob = new Blob([`﻿${lignes.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lignes-rejetees.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-amber-900">
          {rejets.length} ligne{rejets.length > 1 ? "s" : ""} rejetée{rejets.length > 1 ? "s" : ""}
        </span>
        <button type="button" onClick={telecharger} className="text-xs font-medium text-amber-900 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          Télécharger le rapport
        </button>
      </div>
      <ul className="max-h-48 overflow-y-auto text-xs text-amber-900">
        {rejets.slice(0, 50).map((r, i) => (
          <li key={`${r.numero}-${i}`} className="py-0.5">
            <b>Ligne {r.numero}</b> — {r.valeur} : {r.motif}
          </li>
        ))}
      </ul>
      {rejets.length > 50 && <p className="mt-1 text-xs text-amber-800">…et {rejets.length - 50} autres, dans le rapport.</p>}
    </div>
  );
}
