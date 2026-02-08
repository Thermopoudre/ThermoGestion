import { Skeleton, SkeletonKPIGrid } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" variant="rounded" />
          <Skeleton className="h-4 w-72" />
        </div>
        
        {/* KPI Cards */}
        <SkeletonKPIGrid />
        
        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-56 w-full" variant="rounded" />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-56 w-full" variant="rounded" />
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm space-y-3">
            <Skeleton className="h-5 w-32 mb-4" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="circular" width={36} height={36} />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2 mt-1" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm space-y-3">
            <Skeleton className="h-5 w-32 mb-4" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-16" variant="rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
