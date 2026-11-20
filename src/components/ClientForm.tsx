"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { Button, Input, Select, Textarea } from "@/components/ui";
import AdresseInput from "@/components/AdresseInput";
import AlerteDoublon from "@/components/AlerteDoublon";
import { eur } from "@/lib/utils";
import { usePlan } from "@/components/PlanProvider";
import { VerrouCarte } from "@/components/VerrouPlan";
import type { Client, ClientTarif, Grille, Prestation } from "@/lib/types";

export default function ClientForm({ initial }: { initial?: Client }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    type: initial?.type ?? "particulier",
    nom: initial?.nom ?? "",
    contact: initial?.contact ?? "",
    email: initial?.email ?? "",
    telephone: initial?.telephone ?? "",
    adresse: initial?.adresse ?? "",
    code_postal: initial?.code_postal ?? "",
    ville: initial?.ville ?? "",
    siret: initial?.siret ?? "",
    siren: initial?.siren ?? "",
    adresse_livraison: initial?.adresse_livraison ?? "",
    code_postal_livraison: initial?.code_postal_livraison ?? "",
    ville_livraison: initial?.ville_livraison ?? "",
    notes: initial?.notes ?? "",
    // Surcharge facultative des conditions générales de vente de l'atelier (migration 76).
    cgv: initial?.cgv ?? "",
    // Conditions commerciales négociées : elles pilotent ensuite le chiffrage des devis.
    grille_id: initial?.grille_id ?? "",
    remise_pct: initial?.remise_pct != null ? String(initial.remise_pct) : "",
    delai_paiement_jours: initial?.delai_paiement_jours != null ? String(initial.delai_paiement_jours) : "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [livraisonDifferente, setLivraisonDifferente] = useState(!!initial?.adresse_livraison);
  const [rechercheSiren, setRechercheSiren] = useState(false);
  const [messageSiren, setMessageSiren] = useState("");
  // Séparé du texte plutôt que détecté par un préfixe « ✓ » dans `messageSiren` (lot E-P1) :
  // un caractère glyphe dans une chaîne n'est ni accessible ni cohérent visuellement d'un
  // appareil à l'autre, et forçait à préfixer *tous* les messages de succès pour que le test
  // `startsWith("✓")` fonctionne.
  const [succesSiren, setSuccesSiren] = useState(false);
  const [facturationMensuelle, setFacturationMensuelle] = useState(!!initial?.facturation_mensuelle);
  /**
   * « Ne jamais relancer ce client. »
   *
   * `?? true` et non `!!` : la colonne vaut `true` par défaut en base, et un `!!undefined` sur une
   * fiche chargée avant la migration aurait silencieusement sorti le client de la file de relance
   * au premier enregistrement.
   */
  const [relancesActives, setRelancesActives] = useState(initial?.relances_actives ?? true);
  const [grilles, setGrilles] = useState<Grille[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [clientTarifs, setClientTarifs] = useState<ClientTarif[]>([]);
  const { ouvert } = usePlan();
  const tarifsOuverts = ouvert("tarifs_negocies");
  const [atelierId, setAtelierId] = useState("");
  const [novPrestationId, setNovPrestationId] = useState("");
  const [novPrix, setNovPrix] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: gr }, { data: pr }] = await Promise.all([
        supabase.from("grilles_tarifaires").select("*").eq("actif", true).order("nom"),
        supabase.from("prestations").select("*").eq("actif", true).order("ordre"),
      ]);
      setGrilles((gr as Grille[]) ?? []);
      setPrestations((pr as Prestation[]) ?? []);
      // Les tarifs par prestation sont rattachés à une fiche client existante ; rien à charger
      // tant que le client n'a pas été enregistré une première fois.
      if (initial?.id) {
        const [{ data: membre }, { data: ct }] = await Promise.all([
          supabase.from("users").select("atelier_id").single(),
          supabase.from("client_tarifs").select("*").eq("client_id", initial.id).order("created_at"),
        ]);
        setAtelierId(membre?.atelier_id ?? "");
        setClientTarifs((ct as ClientTarif[]) ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  async function ajouterTarif() {
    if (!initial || !novPrestationId || novPrix === "") return;
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("client_tarifs")
      .insert({ atelier_id: atelierId, client_id: initial.id, prestation_id: novPrestationId, prix_ht: Number(novPrix) })
      .select("*")
      .single();
    if (err) { toast(errorFr(err), "error"); return; }
    setClientTarifs([...clientTarifs, data as ClientTarif]);
    setNovPrestationId("");
    setNovPrix("");
    toast("Tarif négocié ajouté");
  }

  async function supprimerTarif(id: string) {
    const supabase = createClient();
    const { error: err } = await supabase.from("client_tarifs").delete().eq("id", id);
    if (err) { toast(errorFr(err), "error"); return; }
    setClientTarifs(clientTarifs.filter((t) => t.id !== id));
  }

  async function completerDepuisSiren() {
    const propre = f.siren.replace(/\D/g, "");
    if (propre.length !== 9 && propre.length !== 14) {
      setSuccesSiren(false);
      setMessageSiren("Un SIREN fait 9 chiffres, un SIRET 14.");
      return;
    }
    setRechercheSiren(true);
    setMessageSiren("");
    setSuccesSiren(false);
    try {
      const res = await fetch(`/api/entreprise?siren=${propre}`);
      const d = await res.json();
      if (!res.ok) { setMessageSiren(d.error ?? "Recherche impossible."); return; }
      const sansCpVille = (d.adresse ?? "").replace(new RegExp(`\\s*${d.code_postal ?? ""}\\s*${d.ville ?? ""}\\s*$`, "i"), "").trim();
      setF((prev) => ({
        ...prev,
        nom: prev.nom || d.nom || "",
        siren: d.siren ?? prev.siren,
        siret: d.siret ?? prev.siret,
        adresse: prev.adresse || sansCpVille || d.adresse || "",
        code_postal: prev.code_postal || d.code_postal || "",
        ville: prev.ville || d.ville || "",
      }));
      setSuccesSiren(!d.cessee);
      setMessageSiren(d.cessee ? "Attention : entreprise indiquée comme cessée." : d.nom);
    } finally {
      setRechercheSiren(false);
    }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const payload = {
      ...f,
      contact: f.contact || null, email: f.email || null, telephone: f.telephone || null,
      adresse: f.adresse || null, code_postal: f.code_postal || null, ville: f.ville || null,
      siret: f.siret || null, siren: f.siren ? f.siren.replace(/\D/g, "").slice(0, 9) : null,
      // On ne stocke l'adresse de livraison que si elle diffère réellement : c'est ce qui
      // déclenche la mention obligatoire sur la facture.
      adresse_livraison: livraisonDifferente ? (f.adresse_livraison || null) : null,
      code_postal_livraison: livraisonDifferente ? (f.code_postal_livraison || null) : null,
      ville_livraison: livraisonDifferente ? (f.ville_livraison || null) : null,
      notes: f.notes || null,
      cgv: f.cgv.trim() || null,
      // Une condition négociée n'a de sens que sur un compte pro. Si la fiche repasse en
      // particulier, on remet tout à zéro : sinon un tarif fantôme continuerait à s'appliquer.
      grille_id: f.type === "pro" && f.grille_id ? f.grille_id : null,
      remise_pct: f.type === "pro" && f.remise_pct !== "" ? Number(f.remise_pct) : null,
      facturation_mensuelle: f.type === "pro" ? facturationMensuelle : false,
      // Vaut pour les deux types de fiche : un particulier aussi peut demander qu'on cesse de lui
      // écrire, et c'est une demande à laquelle un logiciel doit pouvoir obéir en une case.
      relances_actives: relancesActives,
      delai_paiement_jours: f.type === "pro" && f.delai_paiement_jours !== "" ? Number(f.delai_paiement_jours) : null,
    };
    let err;
    if (initial) {
      ({ error: err } = await supabase.from("clients").update(payload).eq("id", initial.id));
    } else {
      const { data: membre } = await supabase.from("users").select("atelier_id").single();
      ({ error: err } = await supabase.from("clients").insert({ ...payload, atelier_id: membre!.atelier_id }));
    }
    if (err) {
      setError(errorFr(err));
      setLoading(false);
      return;
    }
    toast("Client enregistré");
    router.push("/clients");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Select label="Type" value={f.type} onChange={set("type")}>
        <option value="particulier">Particulier</option>
        <option value="pro">Professionnel</option>
      </Select>
      <Input label="Nom / raison sociale *" value={f.nom} onChange={set("nom")} required />
      {/* Posée sous le champ, pas en tête de formulaire : c'est au moment où l'on écrit le nom
          qu'on peut encore ouvrir la fiche existante plutôt que d'en fabriquer une seconde. */}
      <AlerteDoublon type="client" valeur={f.nom} exclureId={initial?.id} />
      {f.type === "pro" && <Input label="Contact" value={f.contact} onChange={set("contact")} />}
      {f.type === "pro" && (
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input label="SIREN" value={f.siren} onChange={set("siren")} inputMode="numeric" placeholder="9 chiffres" />
            </div>
            {/* Bouton inactif tant que le numéro n'a pas la bonne longueur : un clic qui ne
                produit rien laisse croire à une panne. */}
            <Button
              type="button"
              variant="secondary"
              onClick={completerDepuisSiren}
              disabled={rechercheSiren || ![9, 14].includes(f.siren.replace(/\D/g, "").length)}
            >
              {rechercheSiren ? "…" : "Compléter"}
            </Button>
          </div>
          {messageSiren && (
            <p className={`mt-1 flex items-center gap-1.5 text-sm ${succesSiren ? "text-green-700" : "text-amber-700"}`}>
              {succesSiren && <Check size={14} aria-hidden className="flex-none" />}
              {messageSiren}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Obligatoire sur les factures avec la réforme de la facturation électronique. Saisissez-le
            et le reste de la fiche se remplit tout seul.
          </p>
        </div>
      )}
      {f.type === "pro" && <Input label="SIRET" value={f.siret} onChange={set("siret")} />}
      <Input label="Téléphone" value={f.telephone} onChange={set("telephone")} />
      <Input label="E-mail" type="email" value={f.email} onChange={set("email")} />
      <AdresseInput
        valeur={f.adresse}
        codePostal={f.code_postal}
        onSaisieLibre={(v) => setF((p) => ({ ...p, adresse: v }))}
        onChoisir={(a) => setF((p) => ({ ...p, adresse: a.adresse, code_postal: a.code_postal, ville: a.ville }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Code postal" value={f.code_postal} onChange={set("code_postal")} />
        <Input label="Ville" value={f.ville} onChange={set("ville")} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={livraisonDifferente} onChange={(e) => setLivraisonDifferente(e.target.checked)} className="mt-0.5" />
        <span>
          L&apos;adresse de livraison est différente
          <span className="block text-xs text-gray-500">
            Dans ce cas, elle doit figurer sur la facture — c&apos;est une mention obligatoire.
          </span>
        </span>
      </label>
      {livraisonDifferente && (
        <>
          <AdresseInput
            label="Adresse de livraison"
            valeur={f.adresse_livraison}
            codePostal={f.code_postal_livraison}
            onSaisieLibre={(v) => setF((p) => ({ ...p, adresse_livraison: v }))}
            onChoisir={(a) => setF((p) => ({ ...p, adresse_livraison: a.adresse, code_postal_livraison: a.code_postal, ville_livraison: a.ville }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code postal" value={f.code_postal_livraison} onChange={set("code_postal_livraison")} />
            <Input label="Ville" value={f.ville_livraison} onChange={set("ville_livraison")} />
          </div>
        </>
      )}
      {f.type === "pro" && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-sm font-semibold">Conditions commerciales</div>
          <p className="-mt-2 text-xs text-gray-500">
            Ce que vous avez négocié avec ce client. Tout est repris automatiquement à la création
            d&apos;un devis — vous n&apos;avez plus à y penser, et vous pouvez toujours l&apos;ajuster au cas par cas.
          </p>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Grille tarifaire dédiée</span>
            <Select value={f.grille_id} onChange={set("grille_id")}>
              <option value="">Grille standard de l&apos;atelier</option>
              {grilles.map((g) => (
                <option key={g.id} value={g.id}>{g.nom}{g.is_default ? " (standard)" : ""}</option>
              ))}
            </Select>
            <span className="mt-1 block text-xs text-gray-500">
              Ses devis seront chiffrés au m² avec cette grille au lieu de votre grille standard.
            </span>
          </label>

          <div>
            <Input label="Remise contractuelle (%)" type="number" step="0.1" min="0" max="100" inputMode="decimal" value={f.remise_pct} onChange={set("remise_pct")} placeholder="Ex : 12" />
            <p className="mt-1 text-xs text-gray-500">
              Appliquée d&apos;office sur le total de ses devis, en plus de la grille.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={facturationMensuelle} onChange={(e) => setFacturationMensuelle(e.target.checked)} className="mt-0.5 h-5 w-5" />
            <span>
              Facturation mensuelle récapitulative
              <span className="block text-xs text-gray-500">
                Vous ne facturez pas chantier par chantier : une seule facture en fin de mois regroupe tous ses travaux.
              </span>
            </span>
          </label>

          <div>
            <Input label="Délai de paiement (jours)" type="number" min="0" max="60" inputMode="numeric" value={f.delai_paiement_jours} onChange={set("delai_paiement_jours")} placeholder="Délai de l'atelier par défaut" />
            <p className="mt-1 text-xs text-gray-500">
              Date d&apos;échéance de ses factures. Laissez vide pour garder le délai de votre atelier ; entre
              professionnels, la loi plafonne à 60 jours.
            </p>
          </div>
        </div>
      )}
      {f.type === "pro" && !tarifsOuverts && <VerrouCarte capacite="tarifs_negocies" />}
      {f.type === "pro" && tarifsOuverts && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-sm font-semibold">Tarifs négociés par prestation</div>
          <p className="-mt-2 text-xs text-gray-500">
            Un prix spécifique pour une prestation prime toujours sur la remise contractuelle
            ci-dessus : c&apos;est l&apos;accord le plus précis. Il s&apos;applique automatiquement dès que vous
            ajoutez cette prestation à un devis de ce client.
          </p>
          {!initial ? (
            <p className="text-xs text-gray-500">Enregistrez d&apos;abord la fiche pour déclarer des tarifs spécifiques.</p>
          ) : (
            <>
              {clientTarifs.map((t) => {
                const p = prestations.find((x) => x.id === t.prestation_id);
                return (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                    <span>{p?.nom ?? "Prestation désactivée"}</span>
                    <span className="flex items-center gap-3">
                      <b>{eur(Number(t.prix_ht))}</b>
                      <button type="button" aria-label="Supprimer ce tarif" className="text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => supprimerTarif(t.id)}>
                        <X size={14} aria-hidden />
                      </button>
                    </span>
                  </div>
                );
              })}
              {clientTarifs.length === 0 && <p className="text-xs text-gray-400">Aucun tarif spécifique pour l&apos;instant.</p>}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select label="Prestation" value={novPrestationId} onChange={(e) => setNovPrestationId(e.target.value)}>
                    <option value="">— Choisir —</option>
                    {prestations.filter((p) => !clientTarifs.some((t) => t.prestation_id === p.id)).map((p) => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </Select>
                </div>
                <div className="w-28">
                  <Input label="Prix HT €" type="number" step="0.01" min="0" inputMode="decimal" value={novPrix} onChange={(e) => setNovPrix(e.target.value)} />
                </div>
                <Button type="button" variant="secondary" disabled={!novPrestationId || novPrix === ""} onClick={ajouterTarif}>Ajouter</Button>
              </div>
            </>
          )}
        </div>
      )}
      {/* Hors du bloc « professionnel » : la demande « arrêtez de m'écrire » n'a pas de type de
          client. Elle prime sur les réglages de chaque devis et de chaque facture. */}
      <label className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
        <input
          type="checkbox"
          checked={!relancesActives}
          onChange={(e) => setRelancesActives(!e.target.checked)}
          className="mt-0.5 h-5 w-5"
        />
        <span>
          Ne jamais relancer ce client automatiquement
          <span className="block text-xs text-gray-500">
            Aucun de ses devis ni de ses factures ne partira en relance, quels que soient les
            réglages de chaque document. À cocher quand un donneur d&apos;ordre demande qu&apos;on
            cesse de lui écrire — c&apos;est le seul interrupteur qui vaut pour tout son compte.
          </span>
        </span>
      </label>

      {/* Migration 76 — surcharge facultative des conditions générales de vente de l'atelier.
          Facultatif et clairement présenté comme un remplacement, pas un ajout : deux textes
          juridiques bout à bout finiraient par se contredire. */}
      <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <Textarea
          label="Conditions générales de vente négociées avec ce client"
          value={f.cgv}
          onChange={set("cgv")}
          rows={6}
          placeholder="Laissez vide pour appliquer les conditions générales par défaut de l'atelier (Réglages → Atelier)."
        />
        <p className="text-xs text-gray-500">
          Facultatif. Si vous renseignez ce champ, il <b>remplace entièrement</b> les conditions
          générales de l&apos;atelier sur les devis et factures de ce client — les deux textes ne
          s&apos;additionnent jamais. Comme pour l&apos;atelier, le texte figé sur un document déjà
          envoyé ou émis ne change plus, quoi que vous modifiiez ici ensuite.
        </p>
      </div>

      <Textarea label="Notes" value={f.notes} onChange={set("notes")} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}
