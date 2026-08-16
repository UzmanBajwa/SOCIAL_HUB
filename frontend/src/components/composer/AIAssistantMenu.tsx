import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { runAIAction, type AIAction } from "@/api/ai";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";

const TONES = ["friendly", "professional", "playful", "urgent", "formal"];
const LANGUAGES = ["Spanish", "French", "German", "Urdu", "Arabic", "Hindi"];

export function AIAssistantMenu({
  text,
  onResult,
  disabled,
}: {
  text: string;
  onResult: (newText: string) => void;
  disabled?: boolean;
}) {
  const [isRunning, setIsRunning] = useState(false);

  async function runAction(action: AIAction, options: Record<string, string> = {}, append = false) {
    setIsRunning(true);
    try {
      const result = await runAIAction(action, text, options);
      onResult(append ? [text, result.text].filter(Boolean).join("\n\n") : result.text);
      if (result.is_mock) {
        toast({
          title: "AI preview applied",
          description: "This is a rule-based preview for now -- connect a real LLM API to enable full AI results.",
        });
      }
    } catch (error) {
      toast({ title: "AI action failed", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled || isRunning} className="gap-1.5">
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI Assistant
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => runAction("improve_writing")}>Improve Writing</DropdownMenuItem>
        <DropdownMenuItem onClick={() => runAction("generate_caption")}>Generate Caption</DropdownMenuItem>
        <DropdownMenuItem onClick={() => runAction("rewrite")}>Rewrite</DropdownMenuItem>
        <DropdownMenuItem onClick={() => runAction("generate_hashtags", {}, true)}>Generate Hashtags</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change Tone</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {TONES.map((tone) => (
                <DropdownMenuItem key={tone} onClick={() => runAction("change_tone", { tone })} className="capitalize">
                  {tone}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Translate</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {LANGUAGES.map((language) => (
                <DropdownMenuItem key={language} onClick={() => runAction("translate", { target_language: language })}>
                  {language}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
