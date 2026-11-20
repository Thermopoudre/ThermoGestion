import { MAJ_LEGAL, MajLegal } from "@/app/legal/maj";

export const metadata = {
  title: "Mentions légales — Thermogestion",
  description: "Éditeur, hébergement et propriété intellectuelle du service Thermogestion, édité par la SASU Royal Motorbike (Thermopoudre), Bandol.",
};

export default function Mentions() {
  return (
    <>
      <h1>Mentions légales</h1>
      <MajLegal />
      <h2>Éditeur</h2>
      <p>
        Thermogestion est un service édité par <b>SASU Royal Motorbike</b>, exerçant sous le nom
        commercial <b>Thermopoudre</b> — société par actions simplifiée à associé unique au capital
        de 5 000 €.<br />
        SIREN 884 381 047 — SIRET 884 381 047 00015 — RCS Toulon 884 381 047 — TVA
        intracommunautaire FR26 884381047.<br />
        Siège social : 120 place des Palmiers, 83150 Bandol, France.<br />
        Directeur de la publication : Alexis Delcroix.<br />
        Contact : contact@thermopoudre.fr.
      </p>
      <h2>Hébergement</h2>
      <p>
        Application hébergée par Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, États-Unis) ;
        données hébergées par Supabase Inc. sur infrastructure AWS, région Paris (eu-west-3), au sein
        de l&apos;Union européenne.
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble du service (interface, textes, logiciels) est la propriété exclusive de la
        SASU Royal Motorbike. Toute reproduction non autorisée est interdite. Les données saisies par
        les ateliers restent leur propriété.
      </p>
      <h2>Médiation de la consommation</h2>
      <p>
        Thermogestion est un service destiné aux professionnels. Dans l&apos;hypothèse où un
        utilisateur consommateur souscrirait au service, il peut recourir gratuitement à un médiateur
        de la consommation en vue de la résolution amiable d&apos;un litige, conformément aux
        articles L.612-1 et suivants du Code de la consommation.
      </p>
      <p className="mt-6 text-xs text-gray-500">Version en vigueur au {MAJ_LEGAL}.</p>
    </>
  );
}
