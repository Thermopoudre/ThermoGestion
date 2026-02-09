export default function ProjetsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-80"></div>
          </div>

          {/* Cards skeleton */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                <div className="flex gap-4">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
