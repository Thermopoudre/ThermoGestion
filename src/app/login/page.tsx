"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import Wordmark from "@/components/Wordmark";
import { track } from "@/lib/track";

function Login() {
  const router = useRouter();
  // Un invité qui avait déjà un compte passe par ici : sans ce report, son jeton d'invitation
  // meurt à la connexion et il atterrit dans son propre atelier sans jamais rejoindre celui qui
  // l'a invité — avec, à l'écran, l'impression que le lien reçu ne marchait pas.
  const invite = useSearchParams().get("invite");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    track("login");
    router.push(invite ? `/onboarding?invite=${encodeURIComponent(invite)}` : "/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="mb-8"><Wordmark className="text-xl" /></div>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight">Connexion</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</Button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        <Link href="/mot-de-passe-oublie" className="font-medium text-brand">Mot de passe oublié ?</Link>
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Pas encore de compte ?{" "}
        <Link
          href={invite ? `/signup?invite=${encodeURIComponent(invite)}` : "/signup"}
          className="font-medium text-brand"
        >
          {invite ? "Créer mon accès" : "Essai gratuit"}
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  // `useSearchParams` impose une frontière de suspense au prérendu.
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
