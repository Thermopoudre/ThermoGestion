"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import Wordmark from "@/components/Wordmark";
import { SITE_URL } from "@/lib/env";

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/reinitialiser`,
    });
    setLoading(false);
    if (error) {
      setError("Impossible d'envoyer le lien pour le moment. Réessayez dans une minute.");
      return;
    }
    // On affiche le même message quel que soit le résultat : dire « cet email n'existe pas »
    // permettrait de deviner qui est client de Thermogestion.
    setEnvoye(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="mb-8"><Wordmark className="text-xl" /></div>
      <h1 className="mb-2 font-display text-2xl font-bold tracking-tight">Mot de passe oublié</h1>

      {envoye ? (
        <>
          <p className="mb-6 text-sm text-gray-600">
            Si un compte existe pour <b>{email}</b>, un lien de réinitialisation vient d&apos;être envoyé.
            Le lien est valable une heure et ne peut servir qu&apos;une fois.
          </p>
          <p className="text-sm text-gray-600">
            Rien reçu au bout de deux minutes ? Pensez à regarder dans les spams, puis{" "}
            <button onClick={() => setEnvoye(false)} className="font-medium text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              réessayez
            </button>.
          </p>
        </>
      ) : (
        <>
          <p className="mb-6 text-sm text-gray-600">
            Indiquez l&apos;adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.
          </p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? "Envoi…" : "Envoyer le lien"}</Button>
          </form>
        </>
      )}

      <p className="mt-6 text-sm text-gray-600">
        <Link href="/login" className="font-medium text-brand">Retour à la connexion</Link>
      </p>
    </main>
  );
}
