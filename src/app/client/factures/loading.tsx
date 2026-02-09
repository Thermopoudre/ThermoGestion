export default function FacturesLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-72"></div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              ))}
            </div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-8">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 ml-auto"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-20"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
