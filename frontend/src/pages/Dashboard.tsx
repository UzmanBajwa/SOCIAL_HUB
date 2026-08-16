import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarClock, Link2, Send, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import { fetchDashboard } from "@/api/dashboard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { SocialHealthScore } from "@/components/dashboard/SocialHealthScore";
import { PostCard } from "@/components/posts/PostCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px]" />
        ))}
      </div>
      <Skeleton className="h-[180px]" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <DashboardHeader name={user?.name} accounts={data?.connected_accounts ?? []} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Link2}
          label="Connected accounts"
          value={data?.total_accounts_connected ?? 0}
          index={0}
        />
        <StatCard
          icon={CalendarClock}
          label="Scheduled posts"
          value={data?.upcoming_scheduled_posts.length ?? 0}
          accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          index={1}
        />
        <StatCard
          icon={TrendingUp}
          label="Published posts"
          value={data?.total_posts_published ?? 0}
          accentClassName="bg-success/10 text-success"
          index={2}
        />
        <StatCard
          icon={Send}
          label="Failed posts"
          value={
            (data?.recent_posts ?? []).filter((p) => p.status === "failed" || p.status === "partially_published")
              .length
          }
          accentClassName="bg-destructive/10 text-destructive"
          index={3}
        />
      </div>

      <SocialHealthScore />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Upcoming scheduled posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.upcoming_scheduled_posts.length ? (
              data.upcoming_scheduled_posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Recent posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.recent_posts.length ? (
              data.recent_posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <p className="text-sm text-muted-foreground">You haven&apos;t created any posts yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Connected accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.connected_accounts.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.connected_accounts.map((account, i) => (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                >
                  <PlatformIcon platform={account.platform} />
                  <span className="truncate text-sm font-medium">{account.account_name}</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No accounts connected yet.{" "}
              <Link to="/accounts" className="font-medium text-primary hover:underline">
                Connect one
              </Link>
              .
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
