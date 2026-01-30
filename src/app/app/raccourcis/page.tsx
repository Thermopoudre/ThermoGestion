import { Keyboard, Command, Search, Plus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: ['⌘', 'K'], description: 'Ouvrir la recherche globale' },
      { keys: ['⌘', '⇧', 'D'], description: 'Aller au Dashboard' },
      { keys: ['⌘', '⇧', 'P'], description: 'Aller aux Projets' },
      { keys: ['⌘', '⇧', 'C'], description: 'Aller aux Clients' },
      { keys: ['Esc'], description: 'Fermer le modal / Annuler' },
    ]
  },
  {
    category: 'Actions rapides',
    items: [
      { keys: ['⌘', 'N'], description: 'Créer un nouveau (contexte actuel)' },
      { keys: ['⌘', 'S'], description: 'Sauvegarder' },
      { keys: ['⌘', 'Enter'], description: 'Valider le formulaire' },
      { keys: ['⌘', 'D'], description: 'Dupliquer l\'élément' },
      { keys: ['⌘', '⌫'], description: 'Supprimer l\'élément' },
    ]
  },
  {
    category: 'Liste & Tableaux',
    items: [
      { keys: ['↑', '↓'], description: 'Naviguer dans la liste' },
      { keys: ['Enter'], description: 'Ouvrir l\'élément sélectionné' },
      { keys: ['⌘', 'A'], description: 'Sélectionner tout' },
      { keys: ['J', 'K'], description: 'Élément suivant / précédent (Vim)' },
    ]
  },
  {
    category: 'Devis & Factures',
    items: [
      { keys: ['⌘', 'P'], description: 'Aperçu PDF' },
      { keys: ['⌘', '⇧', 'E'], description: 'Envoyer par email' },
      { keys: ['⌘', '⇧', 'S'], description: 'Signer le devis' },
      { keys: ['⌘', '⇧', 'C'], description: 'Convertir en projet' },
    ]
  },
  {
    category: 'Aide',
    items: [
      { keys: ['?'], description: 'Afficher cette page de raccourcis' },
      { keys: ['⌘', '/'], description: 'Ouvrir le centre d\'aide' },
    ]
  },
]

export default function RaccourcisPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Keyboard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Raccourcis clavier
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Naviguez plus rapidement dans ThermoGestion
          </p>
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Note :</strong> Sur Windows/Linux, remplacez <kbd className="px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded">⌘</kbd> par <kbd className="px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded">Ctrl</kbd>
          </p>
        </div>

        {/* Shortcuts Grid */}
        <div className="space-y-8">
          {shortcuts.map((section, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3">
                <h2 className="font-bold text-gray-900 dark:text-white">{section.category}</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center justify-between px-6 py-4">
                    <span className="text-gray-700 dark:text-gray-300">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          <kbd className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-mono text-sm border border-gray-200 dark:border-gray-600 shadow-sm">
                            {key}
                          </kbd>
                          {keyIndex < item.keys.length - 1 && (
                            <span className="text-gray-400 mx-1">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Command Palette Info */}
        <div className="mt-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Command className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Palette de commandes</h3>
              <p className="opacity-90">
                Appuyez sur <kbd className="px-2 py-1 bg-white/20 rounded">⌘</kbd> + <kbd className="px-2 py-1 bg-white/20 rounded">K</kbd> pour accéder rapidement à toutes les fonctionnalités
              </p>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">💡 Astuce pro</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Utilisez <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">J</kbd> et <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">K</kbd> pour naviguer dans les listes comme dans Vim.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">⚡ Raccourci préféré</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">⌘</kbd> + <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">K</kbd> puis tapez ce que vous cherchez. C'est magique !
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
