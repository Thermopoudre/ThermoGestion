import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton'

export default function ClientsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32 mb-2" variant="rounded" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2 sm:gap-4">
            <Skeleton className="h-11 w-28" variant="rounded" />
            <Skeleton className="h-11 w-36" variant="rounded" />
          </div>
        </div>
        {/* Barre de filtres skeleton */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1" variant="rounded" />
          <Skeleton className="h-10 w-40" variant="rounded" />
        </div>
        <SkeletonTable rows={8} cols={5} />
      </div>
    </div>
  )
}
