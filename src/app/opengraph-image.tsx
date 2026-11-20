import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, backgroundColor: "#11203A", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
          THERMO<span style={{ color: "#2FB5D2" }}>GESTION</span>
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, marginTop: 40, lineHeight: 1.1 }}>
          Du devis signé à la pièce livrée, sans paperasse.
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#9AA4B2", marginTop: 30 }}>
          Le logiciel des ateliers de thermolaquage — essai gratuit 30 jours
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 50 }}>
          {["#CC0605", "#E25303", "#FAD201", "#57A639", "#2271B3", "#924E7D", "#383E42", "#0A0A0A", "#F1ECE1"].map((c) => (
            <div key={c} style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: c }} />
          ))}
        </div>
      </div>
    ),
    size
  );
}
