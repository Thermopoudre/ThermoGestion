"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import Wordmark from "@/components/Wordmark";

type Etat = "verification" | "pret" | "lien_invalide" | "termine";

export default function ReinitialiserPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [etat, setEtat] = useState<Etat>("verification");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageLien, setMessageLien] = useState("");

  useEffect(() => {
    // Supabase renvoie les erreurs de lien dans le fragment (#error=...&error_code=otp_expired).
    // Le fragment n'est jamais transmis au serveur : il faut le lire ici, sinon l'utilisateur
    // atterrit sur une page muette avec une URL incompréhensible.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = hash.get("error_code");
    if (code) {
      setMessageLien(
        code === "otp_expired"
          ? "Ce lien a expiré ou a déjà été utilisé. Les liens de réinitialisation ne servent qu'une fois et restent valables une heure."
          : "Ce lien n'est pas valide."
      );
      setEtat("lien_invalide");
      return;
    }

    // Sinon, le client Supabase a normalement déjà consommé le fragment et ouvert une session
    // de récupération. On laisse un court délai pour laisser detectSessionInUrl faire son travail.
    let annule = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (annule) return;
      if (data.session) {
        setEtat("pret");
      } else {
        setMessageLien("Ce lien a expiré ou a déjà été utilisé.");
        setEtat("lien_invalide");
      }
    }, 700);
    return () => { annule = true; clearTimeout(t); };
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (motDePasse.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (motDePasse !== confirmation) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    setLoading(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("pwned") || error.message.toLowerCase().includes("compromis")
          ? "Ce mot de passe figure dans des fuites de données connues. Choisissez-en un autre."
          : "Impossible de modifier le mot de passe. Le lien a peut-être expiré."
      );
      return;
    }
    setEtat("termine");
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1800);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="mb-8"><Wordmark className="text-xl" /></div>
      <h1 className="mb-2 font-display text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>

      {etat === "verification" && <p className="text-sm text-gray-600">Vérification du lien…</p>}

      {etat === "lien_invalide" && (
        <>
          <p className="mb-6 text-sm text-gray-600">{messageLien}</p>
          <Link href="/mot-de-passe-oublie" className="rounded-lg bg-brand min-h-[44px] px-4 py-3 text-center text-sm font-medium text-white">
            Demander un nouveau lien
          </Link>
          <p className="mt-6 text-sm text-gray-600">
            <Link href="/login" className="font-medium text-brand">Retour à la connexion</Link>
          </p>
        </>
      )}

      {etat === "pret" && (
        <>
          <p className="mb-6 text-sm text-gray-600">Choisissez un mot de passe d&apos;au moins 8 caractères.</p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input label="Nouveau mot de passe" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required autoComplete="new-password" />
            <Input label="Confirmer le mot de passe" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required autoComplete="new-password" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}</Button>
          </form>
        </>
      )}

      {etat === "termine" && (
        <p className="text-sm text-green-700">
          Mot de passe modifié. Redirection vers votre tableau de bord…
        </p>
      )}
    </main>
  );
}
