export default function ClientLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-6">
        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="p-4 flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
