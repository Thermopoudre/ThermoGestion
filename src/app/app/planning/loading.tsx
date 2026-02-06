export default function PlanningLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl h-96 shadow" />
    </div>
  )
}
