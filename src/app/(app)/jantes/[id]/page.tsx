"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PartagerLien from "@/components/PartagerLien";
import { Badge, Button, Card, EnregistrementEnCours, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import { useEcriture } from "@/components/useEcriture";
import JanteCarte from "@/components/JanteCarte";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { calcTotaux, dateFr, eur, nombreFr } from "@/lib/utils";
import { appliquerForfaitMinimum } from "@/lib/calculs";
import {
  DESSINS_JANTE_DEFAUT,
  FINITIONS_JANTE_DEFAUT,
  OPERATIONS_JANTE,
  STATUTS_JEU,
  avancementJeu,
  libelleJeu,
  ligneJeuJantes,
  lignesOperationsJantes,
  surfaceJante,
} from "@/lib/jantes";
import { useTitreDocument } from "@/lib/titre";
import type { Client, ClientTarif, GrilleCoef, Jante, JantePalier, JeuJantes, OperationJante, Prestation } from "@/lib/types";

/** Statuts recalculés en base à partir de l'état des jantes : ils ne se posent pas à la main. */
const STATUTS_DEDUITS = new Set(["recu", "en_cours", "pret"]);

type Dossier = JeuJantes & { jantes: Jante[]; clients: { nom: string } | null };

export default function JeuJantesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();

  const [jeu, setJeu] = useState<Dossier | null>(null);
  const [atelierId, setAtelierId] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [paliers, setPaliers] = useState<JantePalier[]>([]);
  const [coefs, setCoefs] = useState<GrilleCoef[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [clientTarifs, setClientTarifs] = useState<ClientTarif[]>([]);
  const [grilleDefautId, setGrilleDefautId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { enCours: ecritureEnCours, suivre } = useEcriture();

  const recharger = useCallback(async () => {
    const { data } = await supabase
      .from("jeux_jantes")
      .select("*, clients(nom), vehicules(*), jantes(*)")
      .eq("id", id)
      .single();
    if (!data) return;
    const d = data as unknown as Dossier;
    d.jantes = [...(d.jantes ?? [])].sort(
      (a, b) => ["avg", "avd", "arg", "ard", "secours"].indexOf(a.position) - ["avg", "avd", "arg", "ard", "secours"].indexOf(b.position),
    );
    setJeu(d);
  }, [supabase, id]);

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: pj }, { data: cf }, { data: pr }, { data: ct }, { data: grilles }] = await Promise.all([
        supabase.from("users").select("atelier_id").single(),
        supabase.from("jante_paliers").select("*").order("diametre_min"),
        supabase.from("grille_coefs").select("*"),
        supabase.from("prestations").select("*").eq("actif", true),
        supabase.from("client_tarifs").select("*"),
        supabase.from("grilles_tarifaires").select("id, is_default").eq("actif", true),
      ]);
      setAtelierId(membre!.atelier_id);
      setPaliers((pj as JantePalier[]) ?? []);
      setCoefs((cf as GrilleCoef[]) ?? []);
      setPrestations((pr as Prestation[]) ?? []);
      setClientTarifs((ct as ClientTarif[]) ?? []);
      setGrilleDefautId(((grilles ?? []) as { id: string; is_default: boolean }[]).find((g) => g.is_default)?.id ?? null);
      await recharger();
    })();
  }, [supabase, recharger]);

  useEffect(() => {
    (async () => {
      if (!jeu?.client_id) return;
      const { data } = await supabase.from("clients").select("*").eq("id", jeu.client_id).single();
      setClient(data as Client);
    })();
  }, [supabase, jeu?.client_id]);

  useTitreDocument(jeu?.numero ?? "Jeu de jantes");

  if (!jeu) return <Spinner />;

  const grilleId = client?.grille_id ?? grilleDefautId;
  const st = STATUTS_JEU[jeu.statut] ?? STATUTS_JEU.recu;
  const av = avancementJeu(jeu.jantes.map((r) => r.statut));
  const lectureSeule = jeu.statut === "livre" || jeu.statut === "annule";
  // Deux raisons de figer un champ : le dossier est clos, ou une écriture est encore en vol.
  const fige = lectureSeule || ecritureEnCours;
  const teinteOrigine = !!jeu.teinte && jeu.teinte === jeu.vehicules?.teinte_origine;
  const lienPublic = typeof window !== "undefined" ? `${window.location.origin}/jt/${jeu.public_token}` : "";

  const titre = libelleJeu({
    nbJantes: jeu.nb_jantes,
    diametre: Number(jeu.diametre_pouces),
    dessin: jeu.dessin,
    finition: jeu.finition,
    teinte: jeu.teinte,
    teinteReference: teinteOrigine ? jeu.vehicules?.teinte_reference : null,
    teinteOrigine,
    vehicule: jeu.vehicules,
    finitionsLibelles: Object.fromEntries(coefs.filter((c) => c.categorie === "jante_finition").map((c) => [c.code, c.libelle])),
  });

  /** Opérations réellement cochées sur les jantes, comptées jante par jante. */
  const operationsComptees = jeu.jantes.reduce<Partial<Record<OperationJante, number>>>((acc, r) => {
    for (const op of (r.operations ?? []) as OperationJante[]) acc[op] = (acc[op] ?? 0) + 1;
    return acc;
  }, {});

  /**
   * Écriture d'un champ du dossier, avec son attente rendue visible.
   *
   * Ces cinq champs (date promise, statut, dessin, finition, note) écrivaient au `blur` ou au
   * `change` sans rien montrer : sur 4G, l'atelier changeait la finition, ne voyait rien bouger,
   * et rechangeait. Les champs sont donc verrouillés le temps de l'aller-retour — un dossier
   * n'a pas deux finitions, on peut se permettre de faire attendre une seconde.
   */
  async function patch(champs: Partial<JeuJantes>) {
    await suivre(async () => {
      const { error } = await supabase.from("jeux_jantes").update(champs).eq("id", id);
      if (error) { toast(errorFr(error), "error"); return; }
      await recharger();
    });
  }

  /**
   * Devis du jeu : la ligne du jeu, puis une ligne par opération mécanique réellement cochée sur
   * les jantes. Les totaux passent par `appliquerForfaitMinimum` et `calcTotaux`, comme partout
   * ailleurs — c'est à la couture entre deux documents que ce projet a perdu de l'argent quatre fois.
   */
  async function creerDevis() {
    setBusy(true);
    const ligne = ligneJeuJantes({
      nbJantes: jeu!.nb_jantes,
      diametre: Number(jeu!.diametre_pouces),
      dessin: jeu!.dessin,
      finition: jeu!.finition,
      teinte: jeu!.teinte,
      teinteReference: teinteOrigine ? jeu!.vehicules?.teinte_reference : null,
      teinteOrigine,
      vehicule: jeu!.vehicules,
      vehiculeId: jeu!.vehicule_id,
      jeuId: jeu!.id,
      grilleId,
      paliers,
      coefs,
      finitionsLibelles: Object.fromEntries(coefs.filter((c) => c.categorie === "jante_finition").map((c) => [c.code, c.libelle])),
    });
    const operations = lignesOperationsJantes({ operations: operationsComptees, prestations, clientId: jeu!.client_id, clientTarifs });

    const remise = client?.remise_pct != null && Number(client.remise_pct) > 0
      ? { type: "pct" as const, valeur: Number(client.remise_pct) }
      : null;
    const { data: grille } = await supabase.from("grilles_tarifaires").select("forfait_minimum").eq("id", grilleId!).maybeSingle();
    const { items } = appliquerForfaitMinimum({ items: [ligne, ...operations], remise, forfaitMinimum: Number(grille?.forfait_minimum ?? 0) });
    const totaux = calcTotaux(items, remise);

    const { data, error } = await supabase.from("devis").insert({
      atelier_id: atelierId, client_id: jeu!.client_id, items, remise,
      notes: jeu!.reserves ? `État constaté à la prise en charge : ${jeu!.reserves}` : null,
      ...totaux,
    }).select("id").single();
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    await patch({ devis_id: data.id });
    router.push(`/devis/${data.id}`);
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-3xl">
      <PageTitle action={<Badge tone={st.ton}>{st.label}</Badge>}>{jeu.numero ?? "Jeu de jantes"}</PageTitle>

      <Card className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-gray-900">{titre}</div>
        <div className="text-xs text-gray-500">
          {jeu.clients?.nom}
          {jeu.vehicules?.immatriculation ? ` · ${jeu.vehicules.immatriculation}` : ""}
          {jeu.largeur_pouces != null ? ` · ${nombreFr(jeu.largeur_pouces, 1)}J` : ""}
          {` · reçu le ${dateFr(jeu.created_at)}`}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-gray-100 px-2 py-0.5">{av.pretes}/{av.total} prêtes</span>
          {av.retouches > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">{av.retouches} en retouche</span>}
          {jeu.tpms && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">Capteurs TPMS</span>}
          {jeu.pneus_montes && <span className="rounded bg-gray-100 px-2 py-0.5">Pneus montés</span>}
          <span className="rounded bg-gray-100 px-2 py-0.5">
            {nombreFr(surfaceJante(Number(jeu.diametre_pouces)) * jeu.nb_jantes)} m² à laquer
          </span>
        </div>
        {jeu.reserves && (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{jeu.reserves}</p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {!jeu.devis_id ? (
          <Button disabled={busy || lectureSeule} onClick={creerDevis}>Chiffrer ce jeu</Button>
        ) : (
          <Link href={`/devis/${jeu.devis_id}`}><Button variant="secondary">Voir le devis</Button></Link>
        )}
        {jeu.projet_id && (
          <Link href={`/projets/${jeu.projet_id}`}><Button variant="secondary">Suivi de production</Button></Link>
        )}
        <a href={`/api/pdf/jantes/${jeu.id}`} target="_blank" rel="noreferrer">
          <Button variant="secondary">Bon de prise en charge (PDF)</Button>
        </a>
      </div>

      <Card className="flex flex-col gap-2">
        <div className="text-sm font-medium">Bon de prise en charge à envoyer au client</div>
        <PartagerLien
          url={lienPublic}
          titre={`Bon de prise en charge ${jeu.numero ?? ""}`}
          texte="Merci de vérifier l'état constaté de chaque jante et de signer avant démontage."
        />
        {jeu.signed_at ? (
          <p className="text-xs text-success-dark">Signé par {jeu.depose_par} le {dateFr(jeu.signed_at)}.</p>
        ) : (
          <p className="text-xs text-gray-500">
            Faites-le signer <b>avant</b> de démonter : c&apos;est le document qui vous protège si le
            garage conteste un choc ou un capteur cassé.
          </p>
        )}
      </Card>

      <div>
        <div className="mb-2 text-sm font-semibold">Les {jeu.jantes.length} jantes</div>
        <div className="flex flex-col gap-2">
          {jeu.jantes.map((r) => (
            <JanteCarte key={r.id} jante={r} atelierId={atelierId} jeuId={jeu.id} lectureSeule={lectureSeule} onChange={recharger} />
          ))}
        </div>
      </div>

      {Object.keys(operationsComptees).length > 0 && (
        <Card className="flex flex-col gap-1">
          <div className="text-sm font-semibold">Opérations mécaniques du jeu</div>
          <p className="-mt-1 text-xs text-gray-500">
            Comptées jante par jante : une seule jante voilée sur quatre se facture 1, pas 4.
          </p>
          {(Object.entries(operationsComptees) as [OperationJante, number][]).map(([code, nb]) => {
            const p = prestations.find((x) => x.code === `JT-${code.toUpperCase().replace(/_/g, "-")}`);
            return (
              <div key={code} className="flex justify-between text-sm">
                <span>{OPERATIONS_JANTE[code]} × {nb}</span>
                <span className={p ? "text-gray-600" : "text-amber-700"}>
                  {p ? eur(Number(p.prix_unitaire_ht) * nb) : "prestation non déclarée"}
                </span>
              </div>
            );
          })}
          {(Object.keys(operationsComptees) as OperationJante[]).some((c) => !prestations.some((p) => p.code === `JT-${c.toUpperCase().replace(/_/g, "-")}`)) && (
            <p className="text-xs text-amber-700">
              Les opérations sans prestation déclarée ne seront pas facturées. Ajoutez-les dans
              Réglages → Prestations pour qu&apos;elles apparaissent sur le devis.
            </p>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Le dossier</div>
          <EnregistrementEnCours actif={ecritureEnCours} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="À rendre le" type="date" defaultValue={jeu.date_promise ?? ""} disabled={fige}
            onBlur={(e) => patch({ date_promise: e.target.value || null })}
          />
          {/* « Reçu », « en cours » et « prêt » sont recalculés en base à partir des jantes :
              les laisser sélectionnables faisait cliquer, puis lire en dessous pourquoi ça n'avait
              rien changé. Ils restent visibles (c'est l'état courant) mais ne se choisissent pas. */}
          <Select
            label="Statut du dossier"
            value={jeu.statut}
            disabled={fige}
            onChange={(e) => patch({ statut: e.target.value as JeuJantes["statut"] })}
          >
            {Object.entries(STATUTS_JEU).map(([code, s]) => (
              <option key={code} value={code} disabled={STATUTS_DEDUITS.has(code) && code !== jeu.statut}>
                {s.label}{STATUTS_DEDUITS.has(code) ? " (déduit des jantes)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <p className="-mt-2 text-xs text-gray-500">
          « Reçu », « en cours » et « prêt » se déduisent des jantes elles-mêmes : vous n'avez à
          poser que « livré » ou « annulé », et ceux-là ne sont plus recalculés.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Dessin" value={jeu.dessin} disabled={fige} onChange={(e) => patch({ dessin: e.target.value })}>
            {(coefs.filter((c) => c.grille_id === grilleId && c.categorie === "jante_dessin").length
              ? coefs.filter((c) => c.grille_id === grilleId && c.categorie === "jante_dessin")
              : DESSINS_JANTE_DEFAUT.map((d) => ({ code: d.code, libelle: d.libelle }))
            ).map((d) => <option key={d.code} value={d.code}>{d.libelle}</option>)}
          </Select>
          <Select label="Finition" value={jeu.finition} disabled={fige} onChange={(e) => patch({ finition: e.target.value })}>
            {(coefs.filter((c) => c.grille_id === grilleId && c.categorie === "jante_finition").length
              ? coefs.filter((c) => c.grille_id === grilleId && c.categorie === "jante_finition")
              : FINITIONS_JANTE_DEFAUT.map((f) => ({ code: f.code, libelle: f.libelle }))
            ).map((f) => <option key={f.code} value={f.code}>{f.libelle}</option>)}
          </Select>
        </div>
        <Textarea label="Note interne" defaultValue={jeu.note ?? ""} disabled={fige} onBlur={(e) => patch({ note: e.target.value || null })} />
      </Card>
    </div>
  );
}
