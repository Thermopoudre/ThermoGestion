export default function PoudresLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl h-32 shadow" />
        ))}
      </div>
    </div>
  )
}
