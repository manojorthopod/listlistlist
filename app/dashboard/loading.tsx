// Shown by Next.js immediately while the dashboard Server Component streams in.
// This prevents the blank/Clerk-spinner loading state on navigation to /dashboard.

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={`bg-surface-2 animate-pulse rounded-lg ${className ?? ''}`} />
  )
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-base">
      {/* Nav */}
      <nav className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <SkeletonBox className="h-5 w-28" />
          <div className="flex items-center gap-3">
            <SkeletonBox className="h-4 w-16" />
            <SkeletonBox className="h-4 w-16" />
            <SkeletonBox className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBox className="h-8 w-36" />
            <SkeletonBox className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonBox className="h-9 w-24 rounded-lg" />
            <SkeletonBox className="h-9 w-32 rounded-lg" />
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Listings column */}
          <div className="lg:col-span-2 space-y-4">
            <SkeletonBox className="h-6 w-36" />
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center gap-4">
                  <SkeletonBox className="h-14 w-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBox className="h-4 w-3/4" />
                    <SkeletonBox className="h-3 w-1/2" />
                  </div>
                  <SkeletonBox className="h-7 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar column */}
          <div className="space-y-6">
            {/* Credits card */}
            <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <SkeletonBox className="h-9 w-9 rounded-lg flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <SkeletonBox className="h-4 w-16" />
                  <SkeletonBox className="h-3 w-24" />
                </div>
              </div>
              <SkeletonBox className="h-2 w-full rounded-full" />
              <SkeletonBox className="h-3 w-32" />
            </div>

            {/* Referral widget */}
            <div className="bg-surface border border-border rounded-xl p-6 space-y-3">
              <SkeletonBox className="h-4 w-24" />
              <SkeletonBox className="h-8 w-full rounded-lg" />
              <SkeletonBox className="h-3 w-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
