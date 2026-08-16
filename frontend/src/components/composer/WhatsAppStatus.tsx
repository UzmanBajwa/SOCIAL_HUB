import { Badge } from "@/components/ui/badge";
import type { SocialAccount } from "@/types";

export function WhatsAppStatus({ account }: { account: SocialAccount }) {
  const status = account.extra_data?.whatsapp_connection_status as string | undefined;
  const number = account.extra_data?.whatsapp_number as string | null | undefined;
  const isConnected = status === "connected";

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">WhatsApp Integration</p>
        <p className="text-xs text-muted-foreground">
          {isConnected
            ? `Business Number: ${number}`
            : "No WhatsApp Business number connected to this Page."}
        </p>
      </div>
      <Badge variant={isConnected ? "success" : "secondary"}>{isConnected ? "🟢 Connected" : "Not connected"}</Badge>
    </div>
  );
}
