export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-black text-gray-900 mb-6">
            Thermo<span className="text-blue-600">Gestion</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Logiciel SaaS professionnel pour ateliers de thermolaquage
          </p>
          <div className="bg-white rounded-lg shadow-lg p-8">
            <p className="text-gray-700 mb-4">
              🚀 Projet en cours de développement
            </p>
            <p className="text-sm text-gray-500">
              Stack: Next.js + Supabase + Vercel
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
