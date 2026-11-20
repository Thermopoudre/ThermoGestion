"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";
import { useToast } from "@/components/Toast";
import Wordmark from "@/components/Wordmark";
import AdresseInput, { type AdresseChoisie } from "@/components/AdresseInput";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { track } from "@/lib/track";
import { METIERS, preremplirMetier, type Metier } from "@/lib/metier";

type Fiche = {
  siren: string;
  siret: string | null;
  nom: string | null;
  forme_juridique: string | null;
  code_ape: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  latitude: number | null;
  longitude: number | null;
  cessee: boolean;
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [siren, setSiren] = useState("");
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [messageSiren, setMessageSiren] = useState("");
  const [fiche, setFiche] = useState<Fiche | null>(null);

  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [geo, setGeo] = useState<{ lat: number | null; lon: number | null; verifiee: boolean }>({ lat: null, lon: null, verifiee: false });
  // Aucune valeur par défaut : un choix pré-coché serait validé sans être lu, et l'atelier
  // hériterait d'une grille qui n'est pas la sienne. C'est la seule question de cet écran dont
  // la réponse écrit vraiment quelque chose.
  const [metier, setMetier] = useState<Metier | "">("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("users").select("id, role").maybeSingle();
      if (data) { router.replace(data.role === "comptable" ? "/comptable" : "/dashboard"); return; }
      const invite = new URLSearchParams(window.location.search).get("invite");
      if (invite) {
        const { error: invErr } = await supabase.rpc("accept_invitation", { p_token: invite });
        if (!invErr) {
          // Le cabinet entre directement chez lui. Le faire passer par le tableau de bord de
          // l'atelier — même une fraction de seconde, même pour être aussitôt redirigé — c'est
          // lui montrer un écran qui n'est pas le sien à la seconde où il découvre le produit.
          const { data: moi } = await supabase.from("users").select("role").maybeSingle();
          router.replace(moi?.role === "comptable" ? "/comptable" : "/dashboard");
          router.refresh();
          return;
        }
        // Deux refus très différents se cachaient derrière la même phrase. Celui qui compte —
        // « ce lien n'est pas pour vous » — se lisait « invitation expirée », et l'invité
        // recommençait à l'infini avec un lien parfaitement valide.
        setError(
          /INVITATION_AUTRE_ADRESSE/.test(invErr.message)
            ? errorFr(invErr)
            : "Invitation invalide ou expirée. Créez votre propre atelier ci-dessous, ou demandez un nouveau lien.",
        );
      }
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chercherEntreprise() {
    const propre = siren.replace(/\D/g, "");
    if (propre.length !== 9 && propre.length !== 14) {
      setMessageSiren("Un SIREN fait 9 chiffres, un SIRET 14.");
      return;
    }
    setRechercheEnCours(true);
    setMessageSiren("");
    try {
      const res = await fetch(`/api/entreprise?siren=${propre}`);
      const data = await res.json();
      if (!res.ok) { setMessageSiren(data.error ?? "Recherche impossible."); return; }
      const f = data as Fiche;
      setFiche(f);
      if (f.nom && !nom) setNom(f.nom);
      if (f.adresse) {
        // L'annuaire renvoie l'adresse complète sur une ligne : on retire le code postal
        // et la commune pour ne garder que le numéro et la rue.
        const sansCpVille = f.adresse.replace(new RegExp(`\\s*${f.code_postal ?? ""}\\s*${f.ville ?? ""}\\s*$`, "i"), "").trim();
        setAdresse(sansCpVille || f.adresse);
      }
      if (f.code_postal) setCodePostal(f.code_postal);
      if (f.ville) setVille(f.ville);
      if (f.latitude && f.longitude) setGeo({ lat: f.latitude, lon: f.longitude, verifiee: true });
      if (f.cessee) setMessageSiren("Attention : cette entreprise est indiquée comme cessée dans l'annuaire.");
    } finally {
      setRechercheEnCours(false);
    }
  }

  function choisirAdresse(a: AdresseChoisie) {
    setAdresse(a.adresse);
    setCodePostal(a.code_postal);
    setVille(a.ville);
    setGeo({ lat: a.latitude, lon: a.longitude, verifiee: a.verifiee });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data: atelierId, error: err } = await supabase.rpc("create_atelier", { p_nom: nom });
    if (err) { setError(errorFr(err)); setLoading(false); return; }

    const sirenPropre = siren.replace(/\D/g, "");
    // L'atelier est créé : si ce complément d'identité échoue, il ne faut ni bloquer l'entrée dans
    // le produit, ni laisser croire que le SIREN et l'adresse ont été enregistrés — ils
    // conditionnent la mention légale de chaque devis et de chaque facture.
    const { error: errIdentite } = await supabase.from("ateliers").update({
      siren: sirenPropre.length >= 9 ? sirenPropre.slice(0, 9) : null,
      siret: fiche?.siret ?? (sirenPropre.length === 14 ? sirenPropre : null),
      tva_intra: sirenPropre.length >= 9
        ? (await supabase.rpc("tva_intra_depuis_siren", { p_siren: sirenPropre.slice(0, 9) })).data ?? null
        : null,
      forme_juridique: fiche?.forme_juridique ?? null,
      code_ape: fiche?.code_ape ?? null,
      adresse: adresse || null,
      code_postal: codePostal || null,
      ville: ville || null,
      latitude: geo.lat,
      longitude: geo.lon,
      adresse_verifiee: geo.verifiee,
      telephone: telephone || null,
    }).eq("id", atelierId);
    if (errIdentite) toast(`Atelier créé, mais son identité n'a pas pu être enregistrée : ${errorFr(errIdentite)} Complétez-la dans Réglages.`, "error");

    // Le métier choisi écrit vraiment : grille, paliers, coefficients, barème au pouce,
    // prestations, parcours de production et référentiel qualité. Sans ça, la question posée
    // deux écrans plus haut ne serait qu'un sondage.
    if (metier) {
      const { erreurs } = await preremplirMetier(supabase, atelierId as string, metier);
      if (erreurs.length) {
        toast(
          `Atelier créé. Certains réglages n'ont pas pu être posés (${erreurs[0]}). Vous pouvez les créer depuis Réglages.`,
          "error",
        );
      }
    }

    track("atelier_created");
    router.push("/dashboard");
    router.refresh();
  }

  // Reliquat vague 3 — même motif que `/clients` : `metadata` (côté `page.tsx` serveur) pose le
  // titre au chargement direct, `useTitreDocument` le reprend après montage. Posé avant le `if
  // (checking)` : un hook ne doit pas dépendre d'un retour anticipé pour rester appelé à chaque
  // rendu.
  useTitreDocument("Bienvenue");

  if (checking) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="mb-8"><Wordmark className="text-xl" /></div>
      <h1 className="mb-1 font-display text-2xl font-bold tracking-tight">Bienvenue</h1>
      <p className="mb-6 text-sm text-gray-600">
        Créons votre atelier. Votre SIREN suffit : on récupère le reste automatiquement.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="SIREN ou SIRET"
                value={siren}
                onChange={(e) => setSiren(e.target.value)}
                inputMode="numeric"
                placeholder="884 381 047"
              />
            </div>
            {/* Inactif tant que le numéro n'a pas 9 ou 14 chiffres : un clic sans effet
                donne l'impression que la recherche est cassée. */}
            <Button
              type="button"
              variant="secondary"
              onClick={chercherEntreprise}
              disabled={rechercheEnCours || ![9, 14].includes(siren.replace(/\D/g, "").length)}
            >
              {rechercheEnCours ? "…" : "Rechercher"}
            </Button>
          </div>
          {messageSiren && <p className="mt-1 text-sm text-amber-700">{messageSiren}</p>}
          {fiche && !messageSiren && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-green-700">
              <Check size={14} aria-hidden className="flex-none" />
              {fiche.nom}{fiche.forme_juridique ? ` · ${fiche.forme_juridique}` : ""}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Sert à vos factures : à partir de septembre 2027, la facturation électronique impose ces informations.
            Vous pourrez les compléter plus tard dans les réglages.
          </p>
        </div>

        <Input label="Nom de l'atelier *" value={nom} onChange={(e) => setNom(e.target.value)} required placeholder="Ex : Thermolaquage Dupont" />

        <AdresseInput valeur={adresse} codePostal={codePostal} onChoisir={choisirAdresse} onSaisieLibre={(v) => { setAdresse(v); setGeo({ lat: null, lon: null, verifiee: false }); }} />

        <div className="grid grid-cols-3 gap-2">
          <Input label="Code postal" value={codePostal} onChange={(e) => setCodePostal(e.target.value)} inputMode="numeric" />
          <div className="col-span-2">
            <Input label="Ville" value={ville} onChange={(e) => setVille(e.target.value)} />
          </div>
        </div>
        {adresse && (
          <p className={`-mt-2 flex items-center gap-1.5 text-xs ${geo.verifiee ? "text-green-700" : "text-gray-500"}`}>
            {geo.verifiee && <Check size={12} aria-hidden className="flex-none" />}
            {geo.verifiee ? "Adresse vérifiée dans la Base Adresse Nationale" : "Adresse non vérifiée — choisissez une suggestion pour la valider."}
          </p>
        )}

        <Input label="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} inputMode="tel" />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-gray-900">Quel est votre métier ?</legend>
          <p className="mb-1 text-xs text-gray-500">
            Ça n&apos;a rien de commercial : c&apos;est ce qui nous permet de vous poser vos prix, vos
            prestations et vos étapes de production, au lieu de vous laisser devant des écrans de
            réglages vides. Vous pourrez tout corriger, et rien n&apos;est verrouillé par ce choix.
          </p>
          {METIERS.map((m) => (
            <label
              key={m.code}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                metier === m.code ? "border-brand bg-brand-light/40" : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="metier"
                value={m.code}
                checked={metier === m.code}
                onChange={() => setMetier(m.code)}
                className="mt-1 h-4 w-4 accent-brand"
                required
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{m.titre}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-600">{m.phrase}</span>
                <span className="mt-1 block text-xs italic text-gray-500">{m.exemples}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={loading} disabled={!nom || !metier}>
          {metier ? "Créer mon atelier et poser mes réglages" : "Créer mon atelier"}
        </Button>

        <Card className="bg-gray-50 text-xs text-gray-600">
          Il vous restera à renseigner votre capital, votre RCS ou numéro au répertoire des métiers,
          votre IBAN et votre assurance avant d&apos;émettre votre première facture. Thermogestion vous
          le rappellera au bon moment.
        </Card>
      </form>
    </main>
  );
}
