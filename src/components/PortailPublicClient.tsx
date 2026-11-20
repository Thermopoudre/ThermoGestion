"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Spinner } from "@/components/ui";
import { Filtres, Pagination, useListePaginee } from "@/components/Pagination";
import { dateDepassee, dateFr, eur, STATUS_DEVIS, STATUS_FACTURE, STATUS_PROJET } from "@/lib/utils";
import { SITE_URL } from "@/lib/env";
// D13 — `19&quot;` rendait un guillemet droit ("), pas le symbole pouce (″) que `pouces()` pose
// partout ailleurs (fiche jantes, PDF). Même défaut que « 6.8 kg » côté D6 : deux écrans du même
// produit ne peuvent pas écrire un pouce différemment.
import { pouces } from "@/lib/jantes";
import {
  LIBELLE_PIECE,
  RUBRIQUES_PORTAIL,
  STATUT_BL_CLIENT,
  STATUT_JEU_CLIENT,
  type EnTetePortail,
  type LigneChantier,
  type LigneDevis,
  type LigneDocument,
  type LigneFacture,
  type LigneJeuJantes,
  type LigneLivraison,
  type LignePortail,
  type PagePortail,
  type RubriquePortail,
} from "@/lib/portail";

/**
 * L'espace client.
 *
 * Trois partis pris, tous dictés par qui lit cet écran — un carrossier, debout, sur un téléphone,
 * entre deux véhicules :
 *
 *  · **Le résumé avant la liste.** La première ligne répond aux deux seules questions qui font
 *    décrocher le téléphone : combien de pièces sont chez vous, et combien je vous dois.
 *  · **Une rubrique à la fois.** Six listes empilées sur un écran de 5 pouces, ce sont six listes
 *    que personne ne fait défiler. Les onglets réutilisent le composant `Filtres` du produit.
 *  · **Aucun détail recopié.** Chaque ligne renvoie vers la page à jeton qui existe déjà — le
 *    devis se signe sur `/d/`, la facture se lit sur `/f/`. Recopier ces écrans ici, ce serait
 *    deux endroits à corriger le jour où une mention légale change.
 */
export default function PortailPublicClient({ entete, token }: { entete: EnTetePortail; token: string }) {
  const [rubrique, setRubrique] = useState<RubriquePortail>("chantiers");
  const accent = entete.atelier.couleur || "#147085";
  const r = entete.resume;
  const restant = Number(r.reste_du ?? 0);

  // Horodatage de la consultation, une fois par ouverture de page. Il sert à une seule chose,
  // côté atelier : savoir si le lien envoyé il y a trois semaines a été ouvert, avant de relancer
  // par téléphone. La référence évite un second appel au remontage en mode strict de React.
  const vu = useRef(false);
  useEffect(() => {
    if (vu.current) return;
    vu.current = true;
    // Un échec ici n'a aucune conséquence pour le client : on ne lui montre rien.
    createClient().rpc("portail_vu", { p_token: token }).then(() => {}, () => {});
  }, [token]);

  // Un lien mort et un réseau coupé ne se disent pas de la même façon : le premier demande
  // d'appeler l'atelier, le second de réessayer dans dix secondes. Les confondre, c'est envoyer
  // le client au téléphone pour une coupure de 4G dans un parking souterrain.
  const [lienMort, setLienMort] = useState(false);

  const liste = useListePaginee<LignePortail>(
    (de, a) =>
      createClient()
        .rpc("portail_liste", { p_token: token, p_rubrique: rubrique, p_de: de, p_a: a })
        .then(({ data, error }) => {
          const page = data as PagePortail | null;
          // `null` sans erreur = le jeton a été révoqué ou renouvelé pendant que l'onglet était
          // ouvert. Une liste vide ferait croire à un atelier qui n'a rien fait.
          if (!error) setLienMort(page === null);
          return { data: page?.lignes ?? [], count: page?.total ?? 0, error };
        }),
    rubrique,
  );

  const meta = RUBRIQUES_PORTAIL.find((x) => x.code === rubrique)!;
  const expire = lienMort;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {/* L'atelier d'abord : c'est lui que le client reconnaît, pas Thermogestion. */}
        <header className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {entete.atelier.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entete.atelier.logo_url} alt="" className="h-12 w-12 flex-none rounded object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-gray-500">{entete.atelier.nom}</div>
            <h1 className="font-display text-xl font-bold tracking-tight text-gray-900">
              Votre espace client
            </h1>
            <p className="truncate text-sm text-gray-600">{entete.client.nom}</p>
          </div>
        </header>

        {/* Les deux questions qui déclenchent un appel, répondues avant la liste. */}
        <section aria-label="En un coup d'œil" className="grid grid-cols-2 gap-3">
          <Resume
            valeur={r.chantiers_en_cours + r.jeux_en_cours}
            // D12 — un total muet à côté d'un onglet qui ne compte qu'une des deux natures de
            // dossier (chantiers OU jeux de jantes) ressemble à deux chiffres contradictoires,
            // alors que ce sont juste deux périmètres différents. Le détail dissout la question.
            libelle={libelleDossiersEnCours(r.chantiers_en_cours, r.jeux_en_cours)}
            accent={accent}
          />
          <Resume
            valeur={restant > 0 ? eur(restant) : "à jour"}
            libelle={restant > 0 ? "reste à régler" : "aucune facture due"}
            accent={restant > 0 ? "#b45309" : accent}
          />
        </section>

        {r.devis_a_repondre > 0 && (
          <p className="rounded-lg border border-brand/25 bg-brand-light px-3 py-2.5 text-sm font-medium text-brand-dark">
            {r.devis_a_repondre === 1
              ? "Un devis attend votre réponse."
              : `${r.devis_a_repondre} devis attendent votre réponse.`}{" "}
            <button
              type="button"
              onClick={() => setRubrique("devis")}
              className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Les voir
            </button>
          </p>
        )}

        <Filtres
          label="Rubriques"
          valeur={rubrique}
          onChange={(v) => setRubrique(v)}
          options={RUBRIQUES_PORTAIL.map((x) => ({ valeur: x.code, libelle: x.onglet }))}
        />

        <section aria-live="polite" className="flex flex-col gap-2">
          {expire && (
            <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-dark">
              Ce lien n&apos;est plus valide. Demandez-en un nouveau à {entete.atelier.nom}.
            </p>
          )}
          {!expire && liste.erreur && (
            <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-dark">
              {liste.erreur}{" "}
              <button
                type="button"
                onClick={liste.recharger}
                className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Réessayer
              </button>
            </p>
          )}
          {!expire && liste.lignes === null && (
            <Spinner />
          )}
          {!expire && !liste.erreur && liste.lignes?.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
              {meta.vide}
            </p>
          )}
          {!expire &&
            liste.lignes?.map((l, i) => (
              <LignePortailVue key={`${rubrique}-${i}`} rubrique={rubrique} ligne={l} accent={accent} />
            ))}
          <Pagination liste={liste} nomPluriel={meta.pluriel} />
        </section>

        {/* Le seul geste possible depuis le portail : appeler l'atelier. Volontairement. */}
        {(entete.atelier.telephone || entete.atelier.email) && (
          <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm">
            <div className="font-semibold text-gray-800">Une question ?</div>
            <div className="flex flex-wrap gap-2">
              {entete.atelier.telephone && (
                <a href={`tel:${entete.atelier.telephone.replace(/\s/g, "")}`} className={LIEN_CONTACT}>
                  Appeler {entete.atelier.nom}
                </a>
              )}
              {entete.atelier.email && (
                <a href={`mailto:${entete.atelier.email}`} className={LIEN_CONTACT}>
                  Écrire à l&apos;atelier
                </a>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-500">
          Propulsé par{" "}
          <a
            href={`${SITE_URL}/?utm_source=portail&utm_medium=footer`}
            className="font-medium text-brand underline underline-offset-2"
          >
            Thermogestion
          </a>
        </p>
      </div>
    </main>
  );
}

const LIEN_CONTACT =
  "flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-gray-300 px-4 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * Le libellé du total « en cours » sous le résumé du portail.
 *
 * D12 — un simple total (« 2 en cours chez nous ») pouvait sembler contredire l'onglet
 * « Chantiers », qui n'affiche par nature que les chantiers (ex. 1) : deux vérités, deux
 * périmètres. Le détail entre parenthèses dissout la question sans qu'il y ait deux définitions à
 * faire coïncider — il n'y en a qu'une, elle est juste décomposée ici.
 */
export function libelleDossiersEnCours(chantiers: number, jeux: number): string {
  if (chantiers === 0 && jeux === 0) return "aucun dossier en cours";
  if (chantiers > 0 && jeux > 0) {
    return `dossier${chantiers + jeux > 1 ? "s" : ""} en cours (${chantiers} chantier${chantiers > 1 ? "s" : ""}, ${jeux} jeu${jeux > 1 ? "x" : ""} de jantes)`;
  }
  if (jeux > 0) return `jeu${jeux > 1 ? "x" : ""} de jantes en cours`;
  return "en cours chez nous";
}

function Resume({ valeur, libelle, accent }: { valeur: number | string; libelle: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="font-display text-2xl font-bold leading-tight" style={{ color: accent }}>
        {valeur}
      </div>
      <div className="text-xs text-gray-600">{libelle}</div>
    </div>
  );
}

/**
 * Une ligne de liste, avec son lien vers la page à jeton correspondante.
 *
 * Toute la carte est cliquable — sur un téléphone, viser un lien de 12 pixels au bout d'une
 * ligne est une manœuvre, pas une navigation.
 */
function Carte({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
    </a>
  );
}

function LignePortailVue({ rubrique, ligne, accent }: { rubrique: RubriquePortail; ligne: LignePortail; accent: string }) {
  if (rubrique === "chantiers") {
    const l = ligne as LigneChantier;
    const statut = STATUS_PROJET[l.status];
    const pct = l.etapes_total > 0 ? Math.round((l.etapes_faites / l.etapes_total) * 100) : 0;
    return (
      <Carte href={`/s/${l.jeton}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">{l.nom}</div>
            <div className="truncate text-xs text-gray-500">{l.numero}</div>
          </div>
          {statut && <Badge tone={statut.ton}>{statut.label}</Badge>}
        </div>
        {l.etapes_total > 0 && (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {l.etapes_faites} étape{l.etapes_faites > 1 ? "s" : ""} sur {l.etapes_total}
            </div>
          </>
        )}
        {/* D11 — « Prévu le 14/08 » restait en gris le 3 septembre : rien ne distinguait une date
            tenue d'une date dépassée, alors que le kanban de l'atelier, lui, passe au rouge. Le
            client doit voir le retard au même titre que l'atelier, sans avoir à faire le calcul. */}
        <div className={`mt-2 text-xs ${dateDepassee(l.date_livraison, l.date_promise) ? "font-medium text-danger-dark" : "text-gray-600"}`}>
          {l.date_livraison
            ? `Livré le ${dateFr(l.date_livraison)}`
            : l.date_promise
              ? dateDepassee(l.date_livraison, l.date_promise)
                ? `La date prévue (${dateFr(l.date_promise)}) est dépassée — l'atelier vous tient informé.`
                : `Prévu le ${dateFr(l.date_promise)}`
              : "Date de livraison à confirmer"}
        </div>
      </Carte>
    );
  }

  if (rubrique === "jantes") {
    const l = ligne as LigneJeuJantes;
    const statut = STATUT_JEU_CLIENT[l.statut];
    const v = l.vehicule;
    const vehicule = v ? [v.marque, v.modele, v.immatriculation].filter(Boolean).join(" · ") : null;
    // Un jeu déjà livré n'a plus d'échéance à tenir : le retard ne se juge que sur un dossier
    // encore en atelier (voir `dateDepassee`, qui prend `date_livraison` en premier argument).
    const livre = l.statut === "livre";
    return (
      <Carte href={`/jt/${l.jeton}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">
              {l.nb_jantes} jantes {pouces(Number(l.diametre_pouces))}
              {l.teinte ? ` — ${l.teinte}` : ""}
            </div>
            <div className="truncate text-xs text-gray-500">{vehicule ?? l.numero}</div>
          </div>
          {statut && <Badge tone={statut.ton}>{statut.label}</Badge>}
        </div>
        <div className={`mt-2 text-xs ${!livre && dateDepassee(null, l.date_promise) ? "font-medium text-danger-dark" : "text-gray-600"}`}>
          {l.jantes_pretes > 0 && `${l.jantes_pretes} jante${l.jantes_pretes > 1 ? "s" : ""} terminée${l.jantes_pretes > 1 ? "s" : ""} · `}
          {!livre && l.date_promise && dateDepassee(null, l.date_promise)
            ? `la date prévue (${dateFr(l.date_promise)}) est dépassée — l'atelier vous tient informé.`
            : l.date_promise ? `prévu le ${dateFr(l.date_promise)}` : `déposé le ${dateFr(l.created_at)}`}
        </div>
      </Carte>
    );
  }

  if (rubrique === "devis") {
    const l = ligne as LigneDevis;
    const statut = STATUS_DEVIS[l.status];
    const aSigner = l.status === "envoye";
    return (
      <Carte href={`/d/${l.jeton}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">Devis {l.numero}</div>
            <div className="text-xs text-gray-500">du {dateFr(l.created_at)}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-gray-900">{eur(l.total_ttc)}</div>
            {statut && <Badge tone={statut.ton}>{statut.label}</Badge>}
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          {aSigner
            ? `À signer en ligne${l.expire_le ? ` — valable jusqu'au ${dateFr(l.expire_le)}` : ""}`
            : l.signed_at
              ? `Signé le ${dateFr(l.signed_at)}`
              : "Consulter le détail"}
        </div>
      </Carte>
    );
  }

  if (rubrique === "livraisons") {
    const l = ligne as LigneLivraison;
    const statut = STATUT_BL_CLIENT[l.status];
    return (
      <Carte href={`/bl/${l.jeton}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">Bon de livraison {l.numero}</div>
            <div className="text-xs text-gray-500">
              {l.livre_at ? `Livré le ${dateFr(l.livre_at)}` : `Préparé le ${dateFr(l.created_at)}`}
            </div>
          </div>
          {statut && <Badge tone={statut.ton}>{statut.label}</Badge>}
        </div>
        <div className="mt-2 text-xs text-gray-600">
          {l.nb_colis ? `${l.nb_colis} colis · ` : ""}
          {l.signed_at ? `signé par ${l.recu_par ?? "vos soins"}` : "à signer à la réception"}
        </div>
      </Carte>
    );
  }

  if (rubrique === "factures") {
    const l = ligne as LigneFacture;
    const statut = STATUS_FACTURE[l.status];
    const avoir = l.type === "avoir";
    const du = Number(l.reste_du ?? 0);
    const regle = Number(l.regle ?? 0);
    // Une facture en retard se voit du premier coup d'œil, sinon elle se règle en retard.
    const enRetard = du > 0 && dateDepassee(null, l.due_date);
    return (
      <Carte href={`/f/${l.jeton}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">
              {avoir ? "Avoir" : "Facture"} {l.numero}
            </div>
            <div className="text-xs text-gray-500">
              {l.emise_at ? `émise le ${dateFr(l.emise_at)}` : "en préparation"}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-gray-900">{eur(l.total_ttc)}</div>
            {statut && <Badge tone={statut.ton}>{avoir ? "Avoir" : statut.label}</Badge>}
          </div>
        </div>
        <div className={`mt-2 text-xs ${enRetard ? "font-medium text-danger-dark" : "text-gray-600"}`}>
          {avoir
            ? "En déduction de votre compte"
            : du <= 0
              ? "Réglée — merci"
              : `Reste ${eur(du)}${regle > 0 ? ` (déjà réglé ${eur(regle)})` : ""}${l.due_date ? ` · échéance ${dateFr(l.due_date)}` : ""}`}
        </div>
      </Carte>
    );
  }

  const l = ligne as LigneDocument;
  return (
    <Carte href={`/${l.prefixe}/${l.jeton}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-gray-900">
            {LIBELLE_PIECE[l.piece]} {l.numero}
          </div>
          <div className="text-xs text-gray-500">{dateFr(l.date)}</div>
        </div>
        {l.montant_ttc != null && (
          <div className="font-semibold text-gray-900">{eur(l.montant_ttc)}</div>
        )}
      </div>
    </Carte>
  );
}
