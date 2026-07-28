import { CheckCircle2, Loader2, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { initials } from "@/lib/utils";
import type { SocialAccount } from "@/types";

const STATUS_VARIANT = {
  active: "success",
  expired: "destructive",
  revoked: "destructive",
  error: "destructive",
} as const;

const STATUS_LABEL: Record<SocialAccount["status"], string> = {
  active: "Connected",
  expired: "Token expired",
  revoked: "Access revoked",
  error: "Connection error",
};

export function AccountCard({
  account,
  onDisconnect,
  isDisconnecting,
}: {
  account: SocialAccount;
  onDisconnect: (id: string) => void;
  isDisconnecting: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar className="h-11 w-11">
          <AvatarImage src={account.avatar_url ?? undefined} alt={account.account_name} />
          <AvatarFallback>{initials(account.account_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.account_name}</p>
          {account.account_username && (
            <p className="truncate text-xs text-muted-foreground">@{account.account_username}</p>
          )}
          <div className="mt-1.5">
            {account.status === "active" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {STATUS_LABEL.active}
              </span>
            ) : (
              <Badge variant={STATUS_VARIANT[account.status]}>{STATUS_LABEL[account.status]}</Badge>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDisconnect(account.id)}
          disabled={isDisconnecting}
          aria-label="Disconnect account"
        >
          {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
        </Button>
      </CardContent>
    </Card>
  );
}
