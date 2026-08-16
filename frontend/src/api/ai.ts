import { api } from "@/lib/api";

export type AIAction =
  | "improve_writing"
  | "generate_caption"
  | "rewrite"
  | "translate"
  | "generate_hashtags"
  | "change_tone";

export interface AIAssistResult {
  text: string;
  is_mock: boolean;
}

export async function runAIAction(action: AIAction, text: string, options: Record<string, string> = {}) {
  const { data } = await api.post<AIAssistResult>("/posts/ai-assist", { action, text, options });
  return data;
}
