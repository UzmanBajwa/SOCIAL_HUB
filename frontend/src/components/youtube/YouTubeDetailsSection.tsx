import { useRef } from "react";
import { Clapperboard, ImagePlus, ListVideo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Media } from "@/types";
import { YOUTUBE_CATEGORIES } from "./constants";
import { StudioSectionCard } from "./StudioSectionCard";
import { YouTubeThumbnailPicker, type YouTubeThumbnailPickerHandle } from "./YouTubeThumbnailPicker";

interface YouTubeDetailsSectionProps {
  title: string;
  description: string;
  category: string;
  thumbnail: Media | null;
  disabled?: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onThumbnail: (media: Media) => void;
  onThumbnailRemove: () => void;
}

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 5000;

export function YouTubeDetailsSection({
  title,
  description,
  category,
  thumbnail,
  disabled,
  onTitleChange,
  onDescriptionChange,
  onCategoryChange,
  onThumbnail,
  onThumbnailRemove,
}: YouTubeDetailsSectionProps) {
  const thumbRef = useRef<YouTubeThumbnailPickerHandle>(null);

  return (
    <StudioSectionCard title="Details" description="Title, description and thumbnail." icon={<ListVideo className="h-4 w-4" />}>
      <div className="space-y-2">
        <Label htmlFor="yt-title" className="flex items-center gap-1">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="yt-title"
          value={title}
          maxLength={TITLE_MAX}
          placeholder="Give your video a title"
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={disabled}
          className="text-base"
        />
        <p className="text-right text-xs text-muted-foreground">{title.length}/{TITLE_MAX}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="yt-description">Description</Label>
        <Textarea
          id="yt-description"
          value={description}
          maxLength={DESCRIPTION_MAX}
          rows={7}
          placeholder="Tell viewers what this video is about"
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          className="text-sm leading-relaxed"
        />
        <p className="text-right text-xs text-muted-foreground">{description.length}/{DESCRIPTION_MAX}</p>
      </div>

      <div className="space-y-2">
        <Label>Thumbnail</Label>
        <YouTubeThumbnailPicker
          ref={thumbRef}
          thumbnail={thumbnail}
          onThumbnail={onThumbnail}
          onRemove={onThumbnailRemove}
          disabled={disabled}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => thumbRef.current?.open()}
            disabled={disabled}
            className="gap-1.5"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Upload file
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            title="Frame selection isn't supported yet"
            className="gap-1.5"
          >
            <Clapperboard className="h-3.5 w-3.5" />
            Select from video
          </Button>
          <span className="text-xs text-muted-foreground">Frame selection is coming soon.</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="yt-category">Category</Label>
        <Select value={category} onValueChange={onCategoryChange} disabled={disabled}>
          <SelectTrigger id="yt-category" className="w-full">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {YOUTUBE_CATEGORIES.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </StudioSectionCard>
  );
}
