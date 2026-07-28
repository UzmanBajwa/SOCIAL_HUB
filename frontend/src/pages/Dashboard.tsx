import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Link2, Send, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import { fetchDashboard } from "@/api/dashboard";
import { PostCard } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Send;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your accounts.</p>
        </div>
        <Button asChild>
          <Link to="/posts/new">Quick create post</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Link2} label="Connected accounts" value={data?.total_accounts_connected ?? 0} />
        <StatCard icon={CalendarClock} label="Scheduled posts" value={data?.upcoming_scheduled_posts.length ?? 0} />
        <StatCard icon={TrendingUp} label="Posts published" value={data?.total_posts_published ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming scheduled posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.upcoming_scheduled_posts.length ? (
              data.upcoming_scheduled_posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent posts</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.connected_accounts.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.connected_accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <span className="truncate text-sm font-medium">{account.account_name}</span>
                </div>
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
