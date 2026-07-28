import { Badge } from "@/components/ui/badge";
import type { PostStatus } from "@/types";

const STATUS_CONFIG: Record<PostStatus, { label: string; variant: "default" | "secondary" | "success" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "default" },
  publishing: { label: "Publishing", variant: "default" },
  published: { label: "Published", variant: "success" },
  partially_published: { label: "Partially published", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

export function PostStatusBadge({ status }: { status: PostStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
