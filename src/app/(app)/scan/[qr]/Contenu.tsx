"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CheckCircle2, Play, Timer, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Spinner } from "@/components/ui";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { enfiler, estErreurReseau } from "@/lib/offline/queue";
import { useFileAttentePointages } from "@/lib/offline/useFileAttente";
import type { Projet } from "@/lib/types";

export default function ScanPage({ params }: { params: Promise<{ qr: string }> }) {
  const { qr } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [projet, setProjet] = useState<Projet | null>(null);
  const [state, setState] = useState<"loading" | "confirm" | "done" | "err">("loading");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // Un chrono tourne-t-il déjà sur ce projet ? Sans cette information, l'opérateur ne sait pas si
  // l'étape qu'il valide a été mesurée — et la première ne l'était jamais.
  const [chronoOuvert, setChronoOuvert] = useState<boolean | null>(null);
  // C4 — mode hors ligne minimal : file de pointages en attente + indicateur, voir lib/offline/.
  const { horsLigne, enAttente, rafraichir: rafraichirFile } = useFileAttentePointages();

  async function charger(projetId: string) {
    const [{ data }, { data: ouverts }] = await Promise.all([
      supabase.from("projets").select("*, clients(nom)").eq("id", projetId).single(),
      supabase.from("temps_etapes").select("id").eq("projet_id", projetId).is("fin", null),
    ]);
    setProjet(data as unknown as Projet);
    setChronoOuvert((ouverts ?? []).length > 0);
  }

  useEffect(() => {
    (async () => {
      const { data: projetId } = await supabase.rpc("projet_par_qr", { p_qr: qr });
      if (!projetId) {
        setMsg("QR inconnu ou projet d'un autre atelier.");
        setState("err");
        return;
      }
      await charger(projetId as string);
      setState("confirm");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, supabase]);

  useTitreDocument("Scan");

  if (state === "loading") return <Spinner />;

  if (state === "err")
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <AlertTriangle size={48} aria-hidden className="text-danger" />
        <p className="font-medium">{msg}</p>
        <Link className="text-sm text-gray-500" href="/projets">← Retour à l&apos;atelier</Link>
      </div>
    );

  const etapeEnCours = projet?.etapes.find((e) => !e.done_at);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-8 text-center">
      {state === "confirm" && projet && (
        <>
          <Card className="w-full">
            <div className="text-lg font-bold">{projet.numero}</div>
            <div className="text-sm text-gray-600">{projet.clients?.nom} · {projet.nom}</div>
          </Card>
          {/* C4 — un pointage posé hors ligne reste en file jusqu'au retour réseau ; ce bandeau est
              le seul signal que l'opérateur a de ne pas re-scanner en boucle. */}
          {enAttente > 0 && (
            <p className="flex w-full items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <WifiOff size={14} aria-hidden />
              {horsLigne ? "Hors ligne" : "Connexion rétablie, synchronisation…"} — {enAttente} pointage{enAttente > 1 ? "s" : ""} en attente
            </p>
          )}
          {etapeEnCours ? (
            <>
              <p className="text-sm text-gray-600">Étape en cours :</p>
              <div className="text-2xl font-bold">{etapeEnCours.libelle}</div>
              {/* Rien ne tourne : le premier geste sur une pièce, c'est la prendre en charge.
                  Sans ce bouton, la première étape n'était jamais chronométrée — le scan ne sait
                  que fermer ce qu'un scan précédent a ouvert. */}
              {chronoOuvert === false && (
                <Button
                  variant="secondary"
                  taille="xl"
                  className="flex w-full items-center justify-center gap-2"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    // Horodatage réel du geste, capturé ici — jamais celui du rejeu à la reconnexion.
                    const survenuA = new Date().toISOString();
                    const { error } = await supabase.rpc("demarrer_etape", { p_projet: projet.id, p_survenu_a: survenuA });
                    if (error) {
                      if (estErreurReseau(error)) {
                        // Hors ligne : le geste part en file, l'écran avance quand même — l'opérateur
                        // ne doit pas re-scanner en boucle simplement parce que le réseau a coupé.
                        await enfiler({ type: "demarrer_etape", projet_id: projet.id, survenu_a: survenuA });
                        setChronoOuvert(true);
                        await rafraichirFile();
                        setBusy(false);
                        return;
                      }
                      setBusy(false); setMsg(errorFr(error)); setState("err"); return;
                    }
                    await charger(projet.id);
                    setBusy(false);
                  }}
                >
                  <><Play size={18} aria-hidden /> Démarrer « {etapeEnCours.libelle} »</>
                </Button>
              )}
              {chronoOuvert && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
                  <Timer size={14} aria-hidden /> Chronométrage en cours
                </p>
              )}
              <Button
                taille="xl"
                className="w-full"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  const survenuA = new Date().toISOString();
                  // Le chronométrage est fait par `avancer_etape` elle-même : c'était le second
                  // appel que trois écrans devaient penser à passer, et qu'une coupure réseau
                  // suffisait à perdre.
                  const { data, error } = await supabase.rpc("avancer_etape", { p_projet_id: projet.id, p_survenu_a: survenuA });
                  if (error) {
                    if (estErreurReseau(error)) {
                      // Hors ligne : mis en file, avec l'horodatage réel du geste. On annonce la
                      // suite en se basant sur les étapes déjà chargées du projet — sans réponse
                      // serveur, on ne peut que la déduire, donc on le dit explicitement.
                      await enfiler({ type: "avancer_etape", projet_id: projet.id, survenu_a: survenuA });
                      await rafraichirFile();
                      const idx = projet.etapes.findIndex((e) => e.code === etapeEnCours.code);
                      const suivante = projet.etapes[idx + 1];
                      setMsg(
                        suivante
                          ? `« ${etapeEnCours.libelle} » enregistrée hors ligne. Étape suivante : ${suivante.libelle}. Sera synchronisée à la reconnexion.`
                          : `« ${etapeEnCours.libelle} » enregistrée hors ligne — dernière étape. Sera synchronisée à la reconnexion.`,
                      );
                      setState("done");
                      setBusy(false);
                      return;
                    }
                    setBusy(false); setMsg(errorFr(error)); setState("err"); return;
                  }
                  // `data.etape` est le code technique (« pret ») : on affiche le libellé de
                  // l'étape correspondante, sinon l'opérateur lit du jargon de base de données.
                  const libelleSuivant = projet.etapes.find((e) => e.code === data?.etape)?.libelle ?? data?.etape;
                  setMsg(data?.done ? "Projet terminé — toutes les étapes sont validées." : `« ${etapeEnCours.libelle} » validée. Étape suivante : ${libelleSuivant}`);
                  setState("done");
                  setBusy(false);
                }}
              >
                <><Check size={18} aria-hidden /> Valider « {etapeEnCours.libelle} »</>
              </Button>
              <Link className="text-sm text-gray-500" href={`/projets/${projet.id}`}>Ouvrir la fiche sans valider</Link>
            </>
          ) : (
            <p className="text-sm text-gray-600">Toutes les étapes sont déjà validées.</p>
          )}
        </>
      )}
      {state === "done" && (
        <>
          <CheckCircle2 size={48} aria-hidden className="text-success" />
          <p className="font-medium">{msg}</p>
          {projet && <Link className="text-brand" href={`/projets/${projet.id}`}>Voir le projet →</Link>}
          <Link className="text-sm text-gray-500" href="/projets">← Retour à l&apos;atelier</Link>
        </>
      )}
    </div>
  );
}
