"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type Toast = { id: number; message: string; type: "success" | "error" };
const ToastCtx = createContext<(message: string, type?: "success" | "error") => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

/**
 * Durée d'affichage. **Un message d'erreur ne s'efface pas tout seul.**
 *
 * POURQUOI. Les deux étaient à 3,5 secondes, et ça a produit un faux bug lors de la recette du
 * 20/08 : « Revenir au brouillon » et « Mettre à la corbeille » ont été rapportés comme échouant
 * en silence sur l'atelier de démonstration. Vérification faite, le refus s'affichait bel et bien
 * — mais en haut de l'écran, alors que le bouton est en bas d'une page longue, et pendant trois
 * secondes et demie. Un agent de recette attentif l'a manqué, puis moi aussi au premier essai.
 * Un exploitant qui cherche à comprendre pourquoi son clic n'a rien fait le manquera aussi, et il
 * appellera.
 *
 * Un succès peut disparaître : il confirme ce qu'on vient de voir arriver. Un échec doit rester,
 * parce qu'il porte l'explication et le chemin de sortie — « émettez un avoir », « ajoutez un
 * siège », « archivez-le plutôt ». C'est le texte qu'on lit deux fois.
 */
const DUREE_SUCCES_MS = 3500;
const DUREE_ERREUR_MS = 15000;

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const retirer = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? DUREE_ERREUR_MS : DUREE_SUCCES_MS);
    },
    [],
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {/* `alert` et `assertive` pour les erreurs : un lecteur d'écran doit les annoncer tout de
          suite, pas attendre une pause. Le conteneur reste au-dessus de tout, y compris des
          fenêtres de confirmation, sans quoi le refus se glisserait derrière la boîte qui vient
          de le provoquer. */}
      <div
        className="pointer-events-none fixed inset-x-0 top-14 z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : undefined}
            aria-live={t.type === "error" ? "assertive" : undefined}
            className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              t.type === "error" ? "bg-red-600" : "bg-gray-900"
            }`}
          >
            <span className="flex-1">
              {/* Icône vectorielle plutôt qu'un caractère : « ⚠ » et « ✓ » se rendent en noir et
                  blanc sur Android, en couleur sur iOS, et sont lus « signe d'avertissement » par
                  un lecteur d'écran au milieu de la phrase. */}
              {t.type === "error"
                ? <AlertTriangle size={16} aria-hidden className="mt-0.5 flex-none" />
                : <CheckCircle2 size={16} aria-hidden className="mt-0.5 flex-none" />}
              {t.message}
            </span>
            {/* La croix n'existe que sur l'erreur : c'est le seul message qui attend qu'on l'ait lu. */}
            {t.type === "error" && (
              <button
                type="button"
                onClick={() => retirer(t.id)}
                aria-label="Fermer ce message"
                className="-mr-1 rounded p-0.5 text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
