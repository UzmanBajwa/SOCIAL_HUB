import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchPosts } from "@/api/posts";
import { PostCard } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PostStatus } from "@/types";

const FILTERS: { value: "all" | PostStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
];

export default function Posts() {
  const [filter, setFilter] = useState<"all" | PostStatus>("all");
  const { data, isLoading } = useQuery({ queryKey: ["posts"], queryFn: fetchPosts });

  const filteredPosts = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data;
    return data.filter((post) => post.status === filter);
  }, [data, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Posts</h1>
          <p className="text-sm text-muted-foreground">All your drafts, scheduled, and published posts.</p>
        </div>
        <Button asChild className="gap-1.5">
          <Link to="/posts/new">
            <Plus className="h-4 w-4" />
            Create post
          </Link>
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : filteredPosts.length ? (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No posts here yet.
        </div>
      )}
    </div>
  );
}
