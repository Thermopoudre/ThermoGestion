export default function Wordmark({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${dark ? "text-white" : "text-ink"} ${className}`}>
      THERMO<span className={dark ? "text-tpblue" : "text-brand"}>GESTION</span>
    </span>
  );
}
