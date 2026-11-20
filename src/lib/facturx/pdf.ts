import { AFRelationship, PDFDocument, PDFHeader, PDFName, PDFString } from "pdf-lib";
import { ICC_SRGB_BASE64 } from "@/lib/facturx/icc";
import { NOM_FICHIER_XML } from "@/lib/facturx/xml";

/**
 * Emballage Factur-X : le PDF lisible par l'humain et le XML lisible par la machine dans un seul
 * fichier. Le destinataire ouvre un PDF ordinaire ; son logiciel comptable, lui, va chercher la
 * pièce jointe `factur-x.xml` et récupère les données sans ressaisie.
 *
 * Trois éléments font la différence entre un PDF avec une pièce jointe et un vrai Factur-X :
 * le fichier joint déclaré `AFRelationship /Alternative` (le XML est une *autre expression* de la
 * même facture, pas une annexe), les métadonnées XMP qui annoncent le profil, et l'intention de
 * sortie couleur exigée par PDF/A.
 */

const NS_FX = "urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#";

function horodatageXmp(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function echapper(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Métadonnées XMP : déclaration PDF/A-3B et bloc Factur-X. Le schéma d'extension `pdfaExtension`
 * est obligatoire — sans lui, un validateur PDF/A rejette les propriétés `fx:` qu'il ne connaît pas.
 */
export function xmpFacturX(o: { titre: string; auteur: string; profil: string; date: Date }) {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${echapper(o.titre)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${echapper(o.auteur)}</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>Thermogestion</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>Thermogestion</xmp:CreatorTool>
      <xmp:CreateDate>${horodatageXmp(o.date)}</xmp:CreateDate>
      <xmp:ModifyDate>${horodatageXmp(o.date)}</xmp:ModifyDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="${NS_FX}">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${NOM_FICHIER_XML}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${echapper(o.profil)}</fx:ConformanceLevel>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>${NS_FX}</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>INVOICE</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The actual version of the Factur-X XML schema</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The conformance level of the embedded Factur-X data</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export type OptionsFacturX = {
  xml: string;
  titre: string;
  auteur: string;
  /** Libellé du profil tel qu'il figure dans le XMP : MINIMUM, BASIC WL… */
  profil?: string;
  date?: Date;
};

/**
 * Transforme un PDF de facture en fichier Factur-X. Le PDF d'entrée n'est pas remis en page :
 * on ne touche qu'à son enveloppe, pour que le document imprimé reste rigoureusement le même.
 */
export async function emballerFacturX(pdf: Uint8Array | Buffer, o: OptionsFacturX): Promise<Uint8Array> {
  const date = o.date ?? new Date();
  // `updateMetadata: false` : sinon pdf-lib réécrit le producteur et la date de modification à
  // l'enregistrement, et le PDF contredirait ses propres métadonnées XMP — un validateur PDF/A
  // s'arrête là.
  const doc = await PDFDocument.load(pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf), { updateMetadata: false });

  // Les fichiers joints n'existent qu'à partir de PDF 1.4, et PDF/A-3 suppose 1.7. Le moteur de
  // rendu écrit un en-tête 1.3 : sans cette bascule, certains lecteurs ignorent la pièce jointe.
  doc.context.header = PDFHeader.forVersion(1, 7);

  doc.setTitle(o.titre);
  doc.setAuthor(o.auteur);
  doc.setProducer("Thermogestion");
  doc.setCreator("Thermogestion");
  doc.setCreationDate(date);
  doc.setModificationDate(date);

  await doc.attach(new TextEncoder().encode(o.xml), NOM_FICHIER_XML, {
    mimeType: "text/xml",
    description: "Facture électronique Factur-X",
    creationDate: date,
    modificationDate: date,
    // /Alternative : le XML dit la même chose que le PDF, sous une autre forme. C'est ce qui
    // distingue une facture Factur-X d'un PDF auquel on aurait agrafé un fichier.
    afRelationship: AFRelationship.Alternative,
  });

  // Intention de sortie : PDF/A exige de savoir dans quel espace couleur le document a été pensé.
  const icc = Uint8Array.from(Buffer.from(ICC_SRGB_BASE64, "base64"));
  const fluxIcc = doc.context.flateStream(icc, { N: 3 });
  const refIcc = doc.context.register(fluxIcc);
  const intention = doc.context.obj({
    Type: "OutputIntent",
    S: "GTS_PDFA1",
    OutputConditionIdentifier: PDFString.of("sRGB"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: refIcc,
  });
  doc.catalog.set(PDFName.of("OutputIntents"), doc.context.obj([intention]));

  const xmp = doc.context.stream(xmpFacturX({ titre: o.titre, auteur: o.auteur, profil: o.profil ?? "MINIMUM", date }), {
    Type: "Metadata",
    Subtype: "XML",
  });
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(xmp));

  // Pas de flux d'objets : le PDF reste lisible par les vieux parseurs comptables, qui sont
  // légion chez les experts-comptables.
  return doc.save({ useObjectStreams: false });
}
