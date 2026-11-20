import { NextRequest, NextResponse } from "next/server";

// Le navigateur ne connaît pas sa propre adresse IP publique : seule la couche serveur la voit.
// Elle est demandée juste avant une signature en ligne (devis, bon de livraison) car, en cas de
// contestation, une signature électronique sans adresse IP horodatée n'a quasiment aucune valeur
// probante.
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const brut =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "";
  // x-forwarded-for empile les proxies : le premier élément est le client.
  const ip = brut.split(",")[0].trim();
  return NextResponse.json({ ip }, { headers: { "cache-control": "no-store" } });
}
