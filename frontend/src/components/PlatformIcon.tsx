import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Platform } from "@/types";

const ICONS: Record<Platform, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
};

const COLORS: Record<Platform, string> = {
  facebook: "text-[#1877F2] bg-[#1877F2]/10",
  instagram: "text-[#E4405F] bg-[#E4405F]/10",
  linkedin: "text-[#0A66C2] bg-[#0A66C2]/10",
  youtube: "text-[#FF0000] bg-[#FF0000]/10",
};

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = ICONS[platform];
  return (
    <div className={cn("flex items-center justify-center rounded-lg p-1.5", COLORS[platform], className)}>
      <Icon className="h-4 w-4" />
    </div>
  );
}
