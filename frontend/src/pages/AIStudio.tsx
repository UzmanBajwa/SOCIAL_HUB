import { motion } from "framer-motion";
import {
  Copy,
  Fingerprint,
  Hash,
  Languages,
  Layers,
  Loader2,
  Mic2,
  PenLine,
  Repeat2,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { runAIAction, type AIAction } from "@/api/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";

const TONES = ["Friendly", "Professional", "Playful", "Urgent", "Formal"];
const LANGUAGES = ["Spanish", "French", "German", "Urdu", "Arabic", "Hindi"];

const QUICK_ACTIONS: { action: AIAction; label: string; icon: typeof Wand2 }[] = [
  { action: "improve_writing", label: "Improve Writing", icon: PenLine },
  { action: "generate_caption", label: "Generate Caption", icon: Wand2 },
  { action: "rewrite", label: "Rewrite", icon: Sparkles },
  { action: "generate_hashtags", label: "Hashtags", icon: Hash },
];

const FEATURE_CARDS = [
  {
    icon: Layers,
    title: "Generate Campaign",
    description: "Turn one idea into a complete content campaign.",
    examples: ["30 days of posts", "Platform variations", "Content calendar"],
    cta: "Create Campaign",
  },
  {
    icon: Repeat2,
    title: "Repurpose Content",
    description: "Transform existing posts into new content formats.",
    examples: ["Old Facebook post → Instagram caption", "LinkedIn update", "Short-form content idea"],
    cta: "Repurpose",
  },
  {
    icon: Fingerprint,
    title: "Brand Voice",
    description: "Teach SocialHub how your company communicates.",
    examples: ["Tone", "Audience", "Keywords", "Writing style"],
    cta: "Setup Brand Voice",
  },
];

export default function AIStudio() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState("");
  const [isMockResult, setIsMockResult] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  async function run(action: AIAction, label: string, options: Record<string, string> = {}) {
    if (!draft.trim()) {
      toast({ title: "Write a draft first", description: "Add some text for the Studio to work with.", variant: "destructive" });
      return;
    }
    setRunningAction(label);
    try {
      const res = await runAIAction(action, draft, options);
      setResult(res.text);
      setIsMockResult(res.is_mock);
    } catch (error) {
      toast({ title: "AI action failed", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setRunningAction(null);
    }
  }

  function copyResult() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast({ title: "Copied to clipboard", variant: "success" });
  }

  function sendToComposer() {
    if (!result) return;
    navigate("/posts/new", { state: { prefillContent: result } });
  }

  function notifyRoadmap(feature: string) {
    toast({
      title: `${feature} is on our roadmap`,
      description: "This capability isn't built yet -- stay tuned for updates.",
    });
  }

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-border p-8 sm:p-10"
      >
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-violet-600/25 blur-[100px]" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-cyan-500/20 blur-[100px]" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            SocialHub Intelligence
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Your <span className="text-gradient-brand">AI social media strategist</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Create, optimize, and plan content across every platform.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {FEATURE_CARDS.map(({ icon: Icon, title, description, examples, cta }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <Card className="h-full shadow-soft transition-shadow hover:shadow-soft-lg hover:border-primary/30">
              <CardContent className="flex h-full flex-col gap-4 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-white glow-brand-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                  <ul className="space-y-1 pt-1">
                    {examples.map((example) => (
                      <li key={example} className="text-xs text-muted-foreground/80">
                        &bull; {example}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="outline" className="w-full" onClick={() => notifyRoadmap(title)}>
                  {cta}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Try it now</CardTitle>
            <CardDescription>Paste an idea, a rough draft, or last week&apos;s caption.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={7}
              placeholder="e.g. announcing our summer sale, 20% off everything this weekend..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(({ action, label, icon: Icon }) => (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={runningAction !== null}
                  onClick={() => run(action, label)}
                >
                  {runningAction === label ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  {label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Mic2 className="h-3.5 w-3.5" /> Change tone
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    disabled={runningAction !== null}
                    onClick={() => run("change_tone", tone, { tone: tone.toLowerCase() })}
                    className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Languages className="h-3.5 w-3.5" /> Translate
              </p>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((language) => (
                  <button
                    key={language}
                    type="button"
                    disabled={runningAction !== null}
                    onClick={() => run("translate", language, { target_language: language })}
                    className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
                  >
                    {language}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Studio output</CardTitle>
              <CardDescription>Review the result, then send it to your composer.</CardDescription>
            </div>
            {isMockResult && result && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Preview mode
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="min-h-[220px] rounded-xl border border-border bg-background/40 p-4 text-sm leading-relaxed">
              {result || <span className="text-muted-foreground">Run an action on the left to see AI output here.</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyResult} disabled={!result}>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button size="sm" className="gap-1.5" onClick={sendToComposer} disabled={!result}>
                <Send className="h-3.5 w-3.5" />
                Send to Composer
              </Button>
            </div>
            {isMockResult && result && (
              <p className="text-xs text-muted-foreground">
                This is a rule-based preview &mdash; connect a real LLM API to enable full AI generation.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
