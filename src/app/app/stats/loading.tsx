export default function StatsLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl h-28 shadow" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl h-64 shadow" />
        <div className="bg-white dark:bg-gray-800 rounded-xl h-64 shadow" />
      </div>
    </div>
  )
}
