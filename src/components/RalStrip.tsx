/** Bande de pastilles RAL — signature visuelle Thermogestion. */
const RALS: [string, string][] = [
  ["RAL 3020", "#CC0605"], ["RAL 2004", "#E25303"], ["RAL 1023", "#FAD201"],
  ["RAL 6018", "#57A639"], ["RAL 5015", "#2271B3"], ["RAL 4008", "#924E7D"],
  ["RAL 7016", "#383E42"], ["RAL 9005", "#0A0A0A"], ["RAL 9010", "#F1ECE1"],
];

export default function RalStrip({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-hidden>
      {RALS.map(([name, hex]) => (
        <span
          key={name}
          title={name}
          className="inline-block rounded-[3px] ring-1 ring-white/15"
          style={{ width: size, height: size, backgroundColor: hex }}
        />
      ))}
    </div>
  );
}
