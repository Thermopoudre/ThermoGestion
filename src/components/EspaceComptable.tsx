"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, FileText, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ecrire } from "@/lib/db";
import { dateFr, eur } from "@/lib/utils";
import type { TonBadge } from "@/lib/tons";
import {
  CADENCES,
  LIBELLE_CADENCE,
  LIBELLE_REGLEMENT,
  etatReglement,
  libellePeriode,
  periodeParDefaut,
  periodesProposees,
  type Cadence,
  type LigneJournal,
  type RemiseComptable,
} from "@/lib/comptable";

const LIBELLE_TYPE: Record<string, string> = {
  acompte: "Acompte",
  solde: "Solde",
  libre: "Facture",
  avoir: "Avoir",
};

const TON_REGLEMENT: Record<"payee" | "partielle" | "attente", TonBadge> = {
  payee: "success",
  partielle: "warning",
  attente: "neutral",
};

type Reglages = {
  cadence: Cadence;
  format: "csv" | "fec";
  destinataire_email: string | null;
  jour_du_mois: number;
  derniere_periode_fin: string | null;
};

/**
 * L'écran que découvre le cabinet.
 *
 * L'ordre des blocs n'est pas décoratif : il suit la seule question que se pose un collaborateur
 * de cabinet en ouvrant le dossier — « quelle période, et est-ce que je l'ai déjà ? ». La période
 * vient donc en premier, la remise précédente juste dessous, le fichier ensuite, le détail des
 * pièces en dernier. Un tableau de bord d'atelier — fournées, taux de charge, alertes de DLU — ne
 * lui dirait rien et lui ferait chercher son export.
 */
export default function EspaceComptable({
  atelierNom,
  peutRegler,
}: {
  atelierNom: string;
  peutRegler: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();

  const proposees = useMemo(() => periodesProposees(), []);
  const defaut = useMemo(() => periodeParDefaut(), []);
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const [libre, setLibre] = useState(false);

  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [remises, setRemises] = useState<RemiseComptable[]>([]);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [chargement, setChargement] = useState(true);

  const libelle = useMemo(() => libellePeriode(debut, fin), [debut, fin]);

  const charger = useCallback(async () => {
    setChargement(true);
    const [{ data: j, error }, { data: r }] = await Promise.all([
      supabase.rpc("journal_ventes", { p_debut: debut, p_fin: fin }),
      supabase
        .from("exports_comptables")
        .select("id, periode_debut, periode_fin, format, remis_at, role_demandeur, automatique, nb_factures, total_ht")
        .order("remis_at", { ascending: false })
        .limit(12),
    ]);
    if (error) toast("Lecture des écritures impossible.", "error");
    setLignes(((j ?? []) as LigneJournal[]) ?? []);
    setRemises(((r ?? []) as RemiseComptable[]) ?? []);
    setChargement(false);
  }, [supabase, debut, fin, toast]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    supabase
      .from("reglages_comptable")
      .select("cadence, format, destinataire_email, jour_du_mois, derniere_periode_fin")
      .maybeSingle()
      .then(({ data }) => setReglages((data as Reglages | null) ?? null));
  }, [supabase]);

  const totaux = useMemo(() => {
    const l = lignes ?? [];
    const somme = (f: (x: LigneJournal) => number) => l.reduce((s, x) => s + f(x), 0);
    const ttc = somme((x) => Number(x.total_ttc ?? 0));
    const regle = somme((x) => Number(x.regle_ttc ?? 0));
    return {
      nb: l.length,
      ht: somme((x) => Number(x.total_ht ?? 0)),
      tva: somme((x) => Number(x.total_tva ?? 0)),
      ttc,
      regle,
      reste: ttc - regle,
    };
  }, [lignes]);

  /** La remise déjà faite pour EXACTEMENT cette période : c'est la question posée, pas une autre. */
  const dejaRemise = useMemo(
    () => remises.find((r) => r.periode_debut === debut && r.periode_fin === fin) ?? null,
    [remises, debut, fin]
  );

  const lien = (format: "csv" | "fec") =>
    `/api/export/comptable?debut=${debut}&fin=${fin}&format=${format}`;

  /**
   * « Tout récupérer » : les deux fichiers, l'un après l'autre. Un ZIP serait plus élégant et
   * bien plus lourd à fabriquer côté serveur pour un gain nul — le cabinet range les deux
   * fichiers dans le même dossier de toute façon. Le décalage évite que le navigateur n'annule
   * le second téléchargement en croyant à un double clic.
   */
  function toutRecuperer() {
    window.location.href = lien("fec");
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = lien("csv");
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      void charger();
    }, 1200);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Écritures et exports</PageTitle>
      <p className="-mt-2 text-sm text-gray-600">
        Vous consultez la facturation de <b>{atelierNom || "cet atelier"}</b> : factures, avoirs et
        règlements, période par période. Cet accès est en lecture seule — rien de ce que vous ferez
        ici ne modifie le dossier de votre client.
      </p>

      {/* 1. La période. C'est la première question du cabinet, c'est le premier bloc. */}
      <Card className="flex flex-col gap-3">
        <div className="text-sm font-semibold text-gray-900">Période à récupérer</div>
        {!libre ? (
          <>
            <Select
              label="Période close"
              value={`${debut}|${fin}`}
              onChange={(e) => {
                const [d, f] = e.target.value.split("|");
                setDebut(d);
                setFin(f);
              }}
            >
              {proposees.map((p) => (
                <option key={`${p.debut}|${p.fin}`} value={`${p.debut}|${p.fin}`}>
                  {p.libelle}
                </option>
              ))}
            </Select>
            <button
              type="button"
              className="self-start text-xs font-medium text-brand underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              onClick={() => setLibre(true)}
            >
              Choisir des dates précises
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Du" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
              <Input label="Au" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
            <button
              type="button"
              className="self-start text-xs font-medium text-brand underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              onClick={() => {
                setLibre(false);
                setDebut(defaut.debut);
                setFin(defaut.fin);
              }}
            >
              Revenir aux périodes closes
            </button>
          </>
        )}
        {/* Seules les périodes closes sont proposées : le mois en cours n'est pas une période
            comptable, et le journal qu'on en tirerait serait faux dès le lendemain. */}
        <p className="text-xs text-gray-500">
          Les écritures portent sur la <b>date d&apos;émission</b>. Les brouillons sont exclus : une
          facture non émise n&apos;existe pas comptablement.
        </p>
      </Card>

      {/* 2. Est-ce que je l'ai déjà eue ? */}
      {dejaRemise && (
        <div className="rounded-lg border border-gray-200 bg-white min-h-[44px] px-4 py-3 text-sm text-gray-700">
          <b>{libelle}</b> vous a déjà été remis le {dateFr(dejaRemise.remis_at)}
          {dejaRemise.automatique ? " (envoi automatique)" : ""} — {dejaRemise.format.toUpperCase()},{" "}
          {dejaRemise.nb_factures} pièce{dejaRemise.nb_factures > 1 ? "s" : ""}.
        </div>
      )}

      {/* 3. Le journal, chiffré, puis les fichiers. */}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold text-gray-900">Journal des ventes — {libelle}</div>
          {chargement && <Spinner taille="sm" />}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-gray-500">Pièces</dt>
            <dd className="font-medium">{totaux.nb}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Total HT</dt>
            <dd className="font-medium">{eur(totaux.ht)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">TVA collectée</dt>
            <dd className="font-medium">{eur(totaux.tva)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Total TTC</dt>
            <dd className="font-medium">{eur(totaux.ttc)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-gray-500">Encaissé sur la période</dt>
            <dd className="font-medium">{eur(totaux.regle)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-gray-500">Reste à encaisser</dt>
            <dd className={`font-medium ${totaux.reste > 0.01 ? "text-amber-800" : ""}`}>
              {eur(totaux.reste)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button className="flex items-center gap-2" onClick={toutRecuperer} disabled={totaux.nb === 0}>
            <Download size={16} aria-hidden /> Tout récupérer (FEC + CSV)
          </Button>
          <a
            href={lien("fec")}
            onClick={() => setTimeout(() => void charger(), 1500)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <FileText size={16} aria-hidden /> FEC seul
          </a>
          <a
            href={lien("csv")}
            onClick={() => setTimeout(() => void charger(), 1500)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <FileSpreadsheet size={16} aria-hidden /> CSV seul
          </a>
        </div>
        <p className="text-xs text-gray-500">
          Le FEC est le fichier réglementaire de l&apos;article A.47 A-1 du LPF, 18 colonnes séparées
          par des tabulations. Le CSV se lit dans un tableur, une ligne par taux de TVA.
        </p>
      </Card>

      {/* 4. Le détail, pour le contrôle de vraisemblance et le pointage des règlements. */}
      <Card className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-gray-900">
          Pièces de la période et état de règlement
        </div>
        {chargement ? (
          <div className="py-6 text-center"><Spinner /></div>
        ) : totaux.nb === 0 ? (
          <p className="py-4 text-sm text-gray-600">
            Aucune facture émise sur {libelle}. Il n&apos;y a rien à récupérer — ce n&apos;est pas une
            erreur d&apos;affichage, c&apos;est une période sans facturation.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th scope="col" className="py-2 pr-3 font-medium">Pièce</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Client</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">HT</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">TVA</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">TTC</th>
                  <th scope="col" className="py-2 font-medium">Règlement</th>
                </tr>
              </thead>
              <tbody>
                {(lignes ?? []).map((f) => {
                  const etat = etatReglement(Number(f.total_ttc ?? 0), Number(f.regle_ttc ?? 0));
                  return (
                    <tr key={f.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="font-medium">{f.numero ?? "—"}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {LIBELLE_TYPE[f.type] ?? f.type}
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{dateFr(f.emise_at)}</td>
                      <td className="py-2 pr-3">
                        {f.client?.nom ?? "—"}
                        {f.client?.siren && (
                          <span className="block text-xs text-gray-500">SIREN {f.client.siren}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">{eur(f.total_ht)}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">{eur(f.total_tva)}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">{eur(f.total_ttc)}</td>
                      <td className="py-2">
                        <Badge tone={TON_REGLEMENT[etat]}>{LIBELLE_REGLEMENT[etat]}</Badge>
                        {etat !== "attente" && (
                          <span className="block text-xs text-gray-500">{eur(f.regle_ttc)} encaissés</span>
                        )}
                        {etat === "attente" && f.due_date && (
                          <span className="block text-xs text-gray-500">échéance {dateFr(f.due_date)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 5. L'historique complet des remises. */}
      {remises.length > 0 && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-gray-900">Ce qui vous a déjà été remis</div>
          <ul className="flex flex-col gap-1 text-sm">
            {remises.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
                <span>
                  <b>{libellePeriode(r.periode_debut, r.periode_fin)}</b>{" "}
                  <span className="text-xs uppercase text-gray-500">{r.format}</span>
                </span>
                <span className="text-xs text-gray-500">
                  remis le {dateFr(r.remis_at)}
                  {r.automatique ? " · envoi automatique" : ""} · {r.nb_factures} pièce
                  {r.nb_factures > 1 ? "s" : ""} · {eur(r.total_ht)} HT
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 6. La cadence — côté atelier seulement. Le cabinet la lit ci-dessus, il ne la règle pas. */}
      {peutRegler ? (
        <CarteCadence
          reglages={reglages}
          onEnregistre={(r) => setReglages(r)}
          toast={toast}
        />
      ) : (
        reglages && reglages.cadence !== "aucune" && (
          <div className="rounded-lg border border-gray-200 bg-white min-h-[44px] px-4 py-3 text-sm text-gray-700">
            <Mail size={14} aria-hidden className="mr-1 inline align-[-2px] text-gray-400" />
            Votre client vous fait parvenir ses écritures{" "}
            <b>{LIBELLE_CADENCE[reglages.cadence].toLowerCase()}</b>, le {reglages.jour_du_mois} du
            mois. Vous n&apos;avez rien à réclamer.
          </div>
        )
      )}
    </div>
  );
}

/**
 * Le réglage de la cadence, réservé à l'atelier.
 *
 * Il est ici plutôt que dans Réglages parce que c'est ici qu'on se pose la question : on vient de
 * voir ce qu'on a remis, on décide de ne plus avoir à y penser. Une case perdue dans un huitième
 * onglet de réglages ne serait jamais cochée.
 */
function CarteCadence({
  reglages,
  onEnregistre,
  toast,
}: {
  reglages: Reglages | null;
  onEnregistre: (r: Reglages) => void;
  toast: (m: string, t?: "success" | "error") => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cadence, setCadence] = useState<Cadence>(reglages?.cadence ?? "aucune");
  const [format, setFormat] = useState<"csv" | "fec">(reglages?.format ?? "fec");
  const [email, setEmail] = useState(reglages?.destinataire_email ?? "");
  const [jour, setJour] = useState(reglages?.jour_du_mois ?? 5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!reglages) return;
    setCadence(reglages.cadence);
    setFormat(reglages.format);
    setEmail(reglages.destinataire_email ?? "");
    setJour(reglages.jour_du_mois);
  }, [reglages]);

  async function enregistrer() {
    if (cadence !== "aucune" && !email.trim()) {
      toast("Indiquez l'adresse de votre cabinet : sans destinataire, rien ne part.", "error");
      return;
    }
    setBusy(true);
    const { data: membre } = await supabase.from("users").select("atelier_id").maybeSingle();
    const atelierId = (membre as { atelier_id: string } | null)?.atelier_id;
    if (!atelierId) {
      setBusy(false);
      toast("Atelier introuvable.", "error");
      return;
    }
    const ligne = {
      atelier_id: atelierId,
      cadence,
      format,
      destinataire_email: email.trim() || null,
      jour_du_mois: jour,
    };
    const ok = await ecrire(
      supabase.from("reglages_comptable").upsert(ligne, { onConflict: "atelier_id" }),
      toast,
      "Cadence enregistrée."
    );
    setBusy(false);
    if (ok) {
      onEnregistre({ ...ligne, derniere_periode_fin: reglages?.derniere_periode_fin ?? null });
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="text-sm font-semibold text-gray-900">Envoi automatique à votre cabinet</div>
      {/* La promesse était affichée en permanence, y compris quand la cadence valait « Aucun
          envoi automatique » — c'est-à-dire quand rien ne part. Un texte au présent qui décrit
          une fonction éteinte est un texte qui ment, et le champ « Adresse du cabinet »
          n'apparaissant qu'après le choix d'une cadence, on pouvait de bonne foi conclure qu'il
          n'existait pas. La phrase suit donc l'état réel. */}
      {cadence === "aucune" ? (
        <p className="text-xs text-gray-600">
          Rien ne part automatiquement pour l&apos;instant : vous téléchargez vos écritures vous-même,
          ci-dessus. Choisissez un rythme et donnez l&apos;adresse de votre cabinet — vous n&apos;aurez
          plus à y penser, et lui n&apos;aura plus à vous relancer.
        </p>
      ) : (
        <p className="text-xs text-gray-600">
          Une fois la période close, Thermogestion écrit à l&apos;adresse ci-dessous : le message
          annonce le nombre de pièces et le total HT, et porte le lien qui ouvre le FEC et le
          journal des ventes sur la bonne période.
        </p>
      )}
      {/* Le lien du courriel mène à /comptable, qui exige un compte : sans accès ouvert, le
          cabinet reçoit une invitation à cliquer sur une porte fermée. C'est le seul endroit du
          produit où cette dépendance se voit. */}
      <p className="text-xs text-gray-500">
        Ce lien ne s&apos;ouvre qu&apos;avec un compte. Donnez à votre cabinet un accès{" "}
        <b>Expert-comptable</b> depuis{" "}
        <Link href="/reglages?onglet=equipe" className="font-medium text-brand underline">
          Réglages → Équipe
        </Link>{" "}
        : il est gratuit, en lecture seule, et ne consomme aucun siège.
      </p>
      <Select label="Cadence" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
        {CADENCES.map((c) => (
          <option key={c} value={c}>{LIBELLE_CADENCE[c]}</option>
        ))}
      </Select>
      {cadence !== "aucune" && (
        <>
          <Input
            label="Adresse du cabinet"
            type="email"
            placeholder="cabinet@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Jour d'envoi"
              type="number"
              min={1}
              max={28}
              value={jour}
              onChange={(e) => setJour(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
            />
            <Select label="Format annoncé" value={format} onChange={(e) => setFormat(e.target.value as "csv" | "fec")}>
              <option value="fec">FEC réglementaire</option>
              <option value="csv">CSV de contrôle</option>
            </Select>
          </div>
          {/* Jamais au-delà du 28 : un « 30 » ne tomberait pas en février et l'envoi sauterait un
              mois sur douze sans que personne ne comprenne pourquoi. */}
          <p className="text-xs text-gray-500">
            Le jour d&apos;envoi s&apos;arrête au 28 pour que février ne soit pas sauté.
            {reglages?.derniere_periode_fin &&
              ` Dernière période envoyée : celle close le ${dateFr(reglages.derniere_periode_fin)}.`}
          </p>
        </>
      )}
      <Button className="self-start" onClick={enregistrer} loading={busy} disabled={busy}>
        Enregistrer la cadence
      </Button>
    </Card>
  );
}
