import { Check, QrCode, ShoppingCart, TriangleAlert } from "lucide-react";

/** Cadre téléphone pour les vignettes produit de la vitrine. */
export function PhoneFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <figure className="w-full max-w-[290px]">
      <div className="rounded-[2rem] border border-ink-line bg-ink-soft p-2 shadow-2xl shadow-ink/40">
        <div className="overflow-hidden rounded-[1.55rem] bg-gray-50">
          <div className="flex items-center justify-between bg-white px-4 pb-1 pt-2 text-[9px] font-medium text-zinc-400">
            <span>9:41</span>
            <span className="h-1.5 w-14 rounded-full bg-zinc-200" />
            <span>5G ▮▮▮</span>
          </div>
          {children}
        </div>
      </div>
      {label && <figcaption className="mt-3 text-center text-sm text-zinc-500">{label}</figcaption>}
    </figure>
  );
}

const T = {
  h: "px-3 pt-2 pb-1 text-[11px] font-bold text-gray-900",
  card: "mx-3 mb-2 rounded-lg border border-gray-200 bg-white p-2.5",
};

/** Suivi client — ce que voit le client final. */
export function DemoSuivi() {
  const etapes = [
    ["Réception", true], ["Sablage", true], ["Poudrage", true],
    ["Cuisson", false], ["Contrôle", false], ["Livraison", false],
  ] as const;
  return (
    <div className="pb-3 text-left">
      <div className="px-3 pt-3 text-center">
        <div className="text-[9px] text-zinc-400">Atelier Démo Thermolaquage</div>
        <div className="text-[13px] font-bold">Suivi de vos pièces</div>
        <div className="text-[9px] text-zinc-500">PR-2026-0042 · Jantes BMW 19&quot; · RAL 7016 satiné</div>
      </div>
      <div className="mx-3 mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full w-1/2 rounded-full bg-success" />
      </div>
      <ul className="mt-2 space-y-1 px-3">
        {etapes.map(([nom, done], i) => {
          const current = !done && etapes.slice(0, i).every(([, d]) => d);
          return (
            <li key={nom} className="flex items-center gap-2 text-[11px]">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] ${done ? "bg-success-light text-success-dark" : current ? "bg-brand-light text-brand" : "bg-gray-100 text-gray-400"}`}>
                {done ? <Check size={10} /> : i + 1}
              </span>
              <span className={done ? "text-gray-400 line-through" : current ? "font-semibold" : "text-gray-500"}>{nom}</span>
              {current && <span className="ml-auto rounded bg-brand-light px-1.5 py-0.5 text-[8px] font-semibold text-brand">EN COURS</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 px-3 text-center text-[9px] text-zinc-400">Prévu le vendredi 10 juillet</p>
    </div>
  );
}

/** Kanban atelier. */
export function DemoKanban() {
  return (
    <div className="pb-3 text-left">
      <div className={T.h}>Atelier</div>
      <div className="flex gap-2 overflow-hidden px-3">
        <div className="w-[45%] shrink-0">
          <div className="mb-1 text-[9px] font-semibold text-gray-500">EN PRODUCTION (3)</div>
          {[["PR-0042", "Jantes 19\"", "cuisson"], ["PR-0043", "Portail 6 m", "poudrage"], ["PR-0044", "Cadre vélo", "sablage"]].map(([n, t, e]) => (
            <div key={n} className="mb-1.5 rounded-lg border border-gray-200 bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold">{n}</span>
                <span className="rounded bg-brand-light px-1 py-0.5 text-[7px] font-semibold text-brand">{e}</span>
              </div>
              <div className="text-[9px] text-gray-500">{t}</div>
            </div>
          ))}
        </div>
        <div className="w-[45%] shrink-0">
          <div className="mb-1 text-[9px] font-semibold text-gray-500">PRÊT (2)</div>
          {[["PR-0040", "Mobilier resto"], ["PR-0041", "Jantes Audi"]].map(([n, t]) => (
            <div key={n} className="mb-1.5 rounded-lg border border-success/30 bg-success-light/40 p-2">
              <div className="text-[10px] font-bold">{n}</div>
              <div className="text-[9px] text-gray-500">{t}</div>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 p-2 text-[9px] text-gray-400">
            <QrCode size={11} /> Scan = étape suivante
          </div>
        </div>
      </div>
    </div>
  );
}

/** Devis public côté client, prêt à signer. */
export function DemoDevis() {
  return (
    <div className="pb-3 text-left">
      <div className={T.h}>Devis DV-2026-0118</div>
      <div className="px-3 text-[9px] text-gray-500">Pour Garage Martin · valable 30 jours</div>
      <div className={`${T.card} mt-2`}>
        {[["Thermolaquage 4 jantes 19\" (RAL 9005 mat)", "280,00 €"], ["Décapage + sablage", "120,00 €"], ["Vernis anti-UV", "60,00 €"]].map(([l, p]) => (
          <div key={l} className="flex justify-between border-b border-gray-100 py-1 text-[9px] last:border-0">
            <span className="pr-2 text-gray-600">{l}</span><span className="shrink-0 font-medium">{p}</span>
          </div>
        ))}
        <div className="flex justify-between pt-1.5 text-[11px] font-bold"><span>Total TTC</span><span>552,00 €</span></div>
      </div>
      <div className={T.card}>
        <div className="text-[9px] font-semibold">Bon pour accord</div>
        <div className="mt-1 h-10 rounded border border-gray-200 bg-gray-50">
          <svg viewBox="0 0 120 32" className="h-full w-full text-gray-700"><path d="M8 24 C 20 8, 30 26, 42 14 S 66 20, 78 12 S 100 22, 112 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <div className="mt-1.5 rounded-lg bg-brand py-1.5 text-center text-[10px] font-semibold text-white">Accepter et signer</div>
      </div>
    </div>
  );
}

/** Stock poudre avec alerte + réappro Thermopoudre. */
export function DemoStock() {
  return (
    <div className="pb-3 text-left">
      <div className={T.h}>Stock poudres</div>
      <div className={`${T.card} !border-warning/40 !bg-warning-light/50`}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-warning-dark">
          <TriangleAlert size={11} /> RAL 7016 texturé — 2,4 kg restants
        </div>
        <div className="mt-1 text-[9px] text-gray-600">Couverture : ~3 jours au rythme actuel</div>
        <div className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-ink py-1.5 text-[10px] font-semibold text-white">
          <ShoppingCart size={11} aria-hidden /> Recommander sur thermopoudre.fr
        </div>
      </div>
      {[["RAL 9005 mat", "14,2 kg", false], ["RAL 9010 brillant", "8,7 kg", false], ["Vernis anti-UV", "5,1 kg", false]].map(([n, s]) => (
        <div key={n as string} className={`${T.card} flex items-center justify-between`}>
          <div>
            <div className="text-[10px] font-medium">{n}</div>
            <div className="text-[8px] text-gray-400">Décompté à chaque cuisson</div>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold">{s}</span>
        </div>
      ))}
    </div>
  );
}
