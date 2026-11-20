/**
 * Adresse IP du signataire, vue par le serveur. Jamais bloquant : si l'appel échoue, la signature
 * doit quand même pouvoir se faire — on perd la mention d'IP, pas l'accord du client.
 */
export async function ipPublique(): Promise<string> {
  try {
    const res = await fetch("/api/ip", { cache: "no-store" });
    if (!res.ok) return "";
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? "";
  } catch {
    return "";
  }
}
