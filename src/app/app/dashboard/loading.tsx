export default function DashboardLoading() {
  return (
    <div className="p-6 animate-pulse">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl h-28 shadow" />
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl h-64 shadow" />
        <div className="bg-white dark:bg-gray-800 rounded-xl h-64 shadow" />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl h-48 shadow" />
        <div className="bg-white dark:bg-gray-800 rounded-xl h-48 shadow" />
      </div>
    </div>
  )
}
