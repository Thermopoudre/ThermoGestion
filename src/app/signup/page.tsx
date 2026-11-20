"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import Wordmark from "@/components/Wordmark";
import { errorFr } from "@/lib/errors";
import { track } from "@/lib/track";
import { LIBELLE_ROLE, estRole } from "@/lib/roles";

/**
 * Ce que le jeton d'invitation donne le droit de savoir.
 *
 * L'adresse du destinataire n'y figure plus **en clair** : `invitation_publique()` ne rend qu'une
 * forme masquée depuis la migration `41_invitation_liee_a_l_adresse_invitee`. Elle était livrée
 * à quiconque détenait le lien — y compris à qui l'avait intercepté — et pré-remplissait ce
 * formulaire, ce qui rendait le lien parfaitement transférable.
 */
type Invitation = { atelier_nom: string; role: string; email_masque: string | null; expires_at: string };

function Signup() {
  const router = useRouter();
  const params = useSearchParams();
  const invite = params.get("invite");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [inviteMort, setInviteMort] = useState(false);

  // Le lien d'invitation dit maintenant de qui il vient et ce qu'il ouvre. Sans ça, l'invité lit
  // l'argumentaire d'essai commercial, croit qu'on lui demande de souscrire, et n'entre jamais.
  useEffect(() => {
    if (!invite) return;
    createClient()
      .rpc("invitation_publique", { p_token: invite })
      .then(({ data }) => {
        const inv = (data ?? null) as Invitation | null;
        if (!inv) { setInviteMort(true); return; }
        setInvitation(inv);
        // Plus de pré-remplissage : l'adresse n'est plus connue de cet écran. L'invité la saisit,
        // et l'indice masqué affiché sous le champ lui dit laquelle de ses boîtes est attendue.
      });
  }, [invite]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    track("signup_start");
    setLoading(true);
    setError("");
    const supabase = createClient();

    // Vérification AVANT la création du compte, et c'est tout l'intérêt : le refus tombait
    // auparavant à l'étape suivante, dans `accept_invitation()`, c'est-à-dire une fois le compte
    // créé — l'invité se retrouvait avec un compte orphelin rattaché à rien, et une adresse
    // qu'il ne pouvait plus changer. Le pire des refus est celui qui arrive trop tard.
    if (invite) {
      const { data: correspond } = await supabase.rpc("invitation_correspond", { p_token: invite, p_email: email });
      if (correspond === false) {
        setLoading(false);
        setError(
          `Cette invitation a été envoyée à ${invitation?.email_masque ?? "une autre adresse"}. ` +
            "Créez votre compte avec cette adresse, ou demandez un nouveau lien à l'atelier.",
        );
        return;
      }
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(errorFr(error));
      return;
    }
    if (data.session) {
      track("signup_done");
      // Le jeton doit survivre à la création du compte : c'est `/onboarding` qui appelle
      // `accept_invitation()`. Il était perdu ici, et l'invité — employé comme cabinet —
      // se retrouvait devant le formulaire de création d'un atelier neuf, avec un essai à lui.
      router.push(invite ? `/onboarding?invite=${encodeURIComponent(invite)}` : "/onboarding");
      router.refresh();
    } else {
      setSent(true);
    }
  }

  const role = estRole(invitation?.role) ? invitation.role : null;
  const cabinet = role === "comptable";

  if (sent)
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6 text-center">
        <MailCheck size={32} aria-hidden className="mx-auto text-brand" />
        <h1 className="mt-2 text-xl font-bold">Vérifiez votre boîte mail</h1>
        <p className="mt-2 text-gray-600">Le lien de confirmation vient de partir à {email}.</p>
        {invite && (
          <p className="mt-3 text-sm text-gray-500">
            Une fois connecté, rouvrez le lien d&apos;invitation qu&apos;on vous a envoyé pour rejoindre
            {invitation?.atelier_nom ? ` ${invitation.atelier_nom}` : " l'atelier"}.
          </p>
        )}
      </main>
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="mb-8"><Wordmark className="text-xl" /></div>

      {invitation ? (
        <>
          <h1 className="mb-1 font-display text-2xl font-bold tracking-tight">
            {cabinet
              ? `${invitation.atelier_nom} vous ouvre l'accès à sa comptabilité`
              : `Rejoignez ${invitation.atelier_nom}`}
          </h1>
          <p className="mb-4 text-sm text-gray-600">
            {cabinet
              ? "Vous n'ouvrez pas d'abonnement et vous n'avez rien à payer : votre client vous donne un accès gratuit, en lecture seule, à ses pièces comptables."
              : `Vous rejoignez un atelier existant. Rien à payer et rien à configurer : votre compte est déjà rattaché.`}
          </p>
          {role && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              <b className="text-gray-900">{LIBELLE_ROLE[role].titre}</b>
              <p className="mt-1">{LIBELLE_ROLE[role].phrase}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="mb-1 font-display text-2xl font-bold tracking-tight">Créer un compte</h1>
          <p className="mb-6 text-sm text-gray-600">
            {inviteMort
              ? "Ce lien d'invitation a expiré ou a déjà servi. Demandez-en un nouveau, ou créez votre propre atelier ci-dessous."
              : "30 jours d'essai gratuit, sans carte bancaire."}
          </p>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        {invitation?.email_masque && (
          <p className="-mt-3 text-xs text-gray-600">
            Ce lien a été envoyé à <b>{invitation.email_masque}</b> : l&apos;invitation ne vaut que
            pour cette adresse. Si ce n&apos;est pas celle que vous utilisez, demandez à
            l&apos;atelier de vous réinviter — c&apos;est l&apos;affaire de dix secondes depuis
            Réglages → Équipe.
          </p>
        )}
        <Input label="Mot de passe (8 caractères min.)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Création…" : invitation ? "Créer mon accès" : "Créer mon compte"}
        </Button>
        <p className="text-xs text-gray-500">
          En créant un compte, vous acceptez les <Link href="/legal/cgu" className="underline">CGU/CGV</Link> et la{" "}
          <Link href="/legal/confidentialite" className="underline">politique de confidentialité</Link>.
        </p>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Déjà inscrit ?{" "}
        <Link href={invite ? `/login?invite=${encodeURIComponent(invite)}` : "/login"} className="font-medium text-brand">
          Connexion
        </Link>
      </p>
    </main>
  );
}

export default function SignupPage() {
  // `useSearchParams` impose une frontière de suspense au prérendu : sans elle, la page bascule
  // en rendu dynamique complet et la vitrine perd sa mise en cache.
  return (
    <Suspense fallback={null}>
      <Signup />
    </Suspense>
  );
}
