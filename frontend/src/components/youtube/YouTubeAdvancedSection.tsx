import { useState } from "react";
import {
  Copyright,
  Languages,
  MapPin,
  Megaphone,
  MessageSquare,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { StudioCollapsible } from "./StudioCollapsible";
import { StudioSectionCard } from "./StudioSectionCard";

function NotWiredNote({ text }: { text: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-amber-600 dark:text-amber-400">Coming soon</span> —{" "}
      {text}
    </p>
  );
}

interface RadioOptionProps {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function RadioOption({ checked, disabled, onClick, children }: RadioOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        checked ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/30",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? "border-primary" : "border-muted-foreground/40"
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      {children}
    </button>
  );
}

const LANGUAGES = [
  "English",
  "Urdu",
  "Arabic",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Japanese",
  "Korean",
  "Chinese (Simplified)",
  "Turkish",
];

const CAPTION_CERTIFICATIONS = [
  "None",
  "English (United Kingdom)",
  "English (United States)",
  "Spanish (Latin America)",
];

export function YouTubeAdvancedSection() {
  const [ageRestricted, setAgeRestricted] = useState<boolean | null>(null);
  const [paidPromotion, setPaidPromotion] = useState(false);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);
  const [videoLanguage, setVideoLanguage] = useState("");
  const [captionCertification, setCaptionCertification] = useState("");
  const [recordingDate, setRecordingDate] = useState("");
  const [videoLocation, setVideoLocation] = useState("");
  const [license, setLicense] = useState("");
  const [allowEmbedding, setAllowEmbedding] = useState(false);
  const [notifySubscribers, setNotifySubscribers] = useState(true);
  const [commentsOn, setCommentsOn] = useState(true);
  const [moderation, setModeration] = useState("none");
  const [commenters, setCommenters] = useState("anyone");
  const [sortOrder, setSortOrder] = useState("top");
  const [showLikes, setShowLikes] = useState(true);

  return (
    <StudioSectionCard
      title="Advanced"
      description="Optional publishing settings"
      icon={<SlidersHorizontal className="h-4 w-4" />}
    >
      <StudioCollapsible
        title="Age restriction (advanced)"
        description="Whether this video is restricted to viewers over 18"
        right={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <RadioOption checked={ageRestricted === false} onClick={() => setAgeRestricted(false)}>
            No, don't restrict my video
          </RadioOption>
          <RadioOption checked={ageRestricted === true} onClick={() => setAgeRestricted(true)}>
            Yes, restrict my video to viewers over 18
          </RadioOption>
        </div>
        <NotWiredNote text="age restriction isn't sent to YouTube yet. Your selection is only kept for this session." />
      </StudioCollapsible>

      <StudioCollapsible
        title="Paid promotion"
        description="Disclose product placements, sponsorships or endorsements"
        right={<Megaphone className="h-4 w-4 text-muted-foreground" />}
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
          <input
            type="checkbox"
            checked={paidPromotion}
            onChange={(e) => setPaidPromotion(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            My video contains paid promotion like a product placement, sponsorship or endorsement.
          </span>
        </label>
        <NotWiredNote text="paid promotion isn't sent to YouTube yet. Your selection is only kept for this session." />
      </StudioCollapsible>

      <StudioCollapsible
        title="AI use"
        description="Was AI used to generate or edit your content in a way that requires disclosure?"
        right={<Sparkles className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <RadioOption checked={aiUsed === false} onClick={() => setAiUsed(false)}>
            No
          </RadioOption>
          <RadioOption checked={aiUsed === true} onClick={() => setAiUsed(true)}>
            Yes
          </RadioOption>
        </div>
        <NotWiredNote text="AI disclosure isn't sent to YouTube yet. Your selection is only kept for this session." />
      </StudioCollapsible>

      <StudioCollapsible
        title="Language and captions certification"
        description="Video language and caption certification"
        right={<Languages className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="yt-language">Video language</Label>
            <Select value={videoLanguage} onValueChange={setVideoLanguage}>
              <SelectTrigger id="yt-language">
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yt-captions">Caption certification</Label>
            <Select value={captionCertification} onValueChange={setCaptionCertification}>
              <SelectTrigger id="yt-captions">
                <SelectValue placeholder="Select a certification" />
              </SelectTrigger>
              <SelectContent>
                {CAPTION_CERTIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <NotWiredNote text="language and caption settings aren't sent to YouTube yet. Your selection is only kept for this session." />
      </StudioCollapsible>

      <StudioCollapsible
        title="Recording date and location"
        description="When and where this video was recorded"
        right={<MapPin className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="yt-recorded-at">Recording date</Label>
            <Input
              id="yt-recorded-at"
              type="date"
              value={recordingDate}
              onChange={(e) => setRecordingDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yt-location">Video location</Label>
            <Input
              id="yt-location"
              type="text"
              value={videoLocation}
              onChange={(e) => setVideoLocation(e.target.value)}
              placeholder="e.g. Lahore, Pakistan"
            />
          </div>
        </div>
        <NotWiredNote text="recording date and location aren't sent to YouTube yet. Your selection is only kept for this session." />
      </StudioCollapsible>

      <StudioCollapsible
        title="License"
        description="Licensing and distribution options"
        right={<Copyright className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="space-y-1.5">
          <Label htmlFor="yt-license">License</Label>
          <Select value={license} onValueChange={setLicense}>
            <SelectTrigger id="yt-license">
              <SelectValue placeholder="Select a license" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard YouTube License</SelectItem>
              <SelectItem value="creative-commons">Creative Commons</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
          <input
            type="checkbox"
            checked={allowEmbedding}
            onChange={(e) => setAllowEmbedding(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">Allow embedding</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
          <input
            type="checkbox"
            checked={notifySubscribers}
            onChange={(e) => setNotifySubscribers(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">Publish to subscriptions feed and notify subscribers</span>
        </label>
        <NotWiredNote text="license and distribution settings aren't sent to YouTube yet. Your selection is only kept for this session." />
      </StudioCollapsible>

      <StudioCollapsible
        title="Shorts remixing"
        description="Allow others to remix this video into Shorts"
        right={<Scissors className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <RadioOption checked={false} disabled onClick={() => {}}>
            Allow video and audio remixing
          </RadioOption>
          <RadioOption checked={false} disabled onClick={() => {}}>
            Allow only audio remixing
          </RadioOption>
          <RadioOption checked={false} disabled onClick={() => {}}>
            Don't allow remixing
          </RadioOption>
        </div>
        <NotWiredNote text="Shorts remixing isn't supported by the current YouTube integration." />
      </StudioCollapsible>

      <StudioCollapsible
        title="Comments and ratings"
        description="Control comments and viewer interactions"
        right={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="yt-comments">Comments</Label>
            <Select value={commentsOn ? "on" : "off"} onValueChange={(v) => setCommentsOn(v === "on")}>
              <SelectTrigger id="yt-comments">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yt-moderation">Moderation</Label>
            <Select value={moderation} onValueChange={setModeration}>
              <SelectTrigger id="yt-moderation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="strict">Strict</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yt-commenters">Who can comment</Label>
            <Select value={commenters} onValueChange={setCommenters}>
              <SelectTrigger id="yt-commenters">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anyone">Anyone</SelectItem>
                <SelectItem value="subscribers">Subscribers only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yt-sort">Sort by</Label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger id="yt-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
          <input
            type="checkbox"
            checked={showLikes}
            onChange={(e) => setShowLikes(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">Show how many viewers like this video</span>
        </label>
        <NotWiredNote text="comment and rating settings aren't sent to YouTube yet. Your selection is only kept for this session." />
      </StudioCollapsible>
    </StudioSectionCard>
  );
}
