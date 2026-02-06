export default function ProjetsLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl h-20 shadow" />
        ))}
      </div>
    </div>
  )
}
