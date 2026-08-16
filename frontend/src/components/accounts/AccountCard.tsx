import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";

import { PlatformIcon } from "@/components/PlatformIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, initials } from "@/lib/utils";
import type { Platform, SocialAccount } from "@/types";

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

const ACCOUNT_TYPE_LABEL: Record<Platform, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram Business",
  linkedin: "LinkedIn Company Page",
  youtube: "YouTube Channel",
};

const DETAIL_LABEL: Record<Platform, string> = {
  facebook: "Page",
  instagram: "Account",
  linkedin: "Company",
  youtube: "Channel",
};

const ACCENT_BAR: Record<Platform, string> = {
  facebook: "bg-[#1877F2] shadow-[0_0_16px_2px_rgba(24,119,242,0.55)]",
  instagram:
    "bg-gradient-to-r from-[#feda75] via-[#d62976] to-[#4f5bd5] shadow-[0_0_16px_2px_rgba(214,41,118,0.5)]",
  linkedin: "bg-[#0A66C2] shadow-[0_0_16px_2px_rgba(10,102,194,0.55)]",
  youtube: "bg-[#FF0000] shadow-[0_0_16px_2px_rgba(255,0,0,0.5)]",
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
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="overflow-hidden shadow-soft transition-shadow hover:shadow-soft-lg">
        <div className={`h-1 ${ACCENT_BAR[account.platform]}`} />
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={account.avatar_url ?? undefined} alt={account.account_name} />
              <AvatarFallback>{initials(account.account_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <PlatformIcon platform={account.platform} className="h-5 w-5 p-1" />
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {ACCOUNT_TYPE_LABEL[account.platform]}
                </p>
              </div>
              <p className="truncate font-medium leading-tight">{account.account_name}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {account.status === "active" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {STATUS_LABEL.active}
              </span>
            ) : (
              <Badge variant={STATUS_VARIANT[account.status]}>{STATUS_LABEL[account.status]}</Badge>
            )}
            <span className="truncate text-xs text-muted-foreground">
              {DETAIL_LABEL[account.platform]}: {account.account_username ? `@${account.account_username}` : account.account_name}
            </span>
          </div>

          <div className="flex gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setManageOpen(true)}>
              <Settings2 className="h-3.5 w-3.5" />
              Manage
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDisconnect(account.id)}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlatformIcon platform={account.platform} />
              {account.account_name}
            </DialogTitle>
            <DialogDescription>{ACCOUNT_TYPE_LABEL[account.platform]}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={account.status === "active" ? "success" : STATUS_VARIANT[account.status]}>
                {STATUS_LABEL[account.status]}
              </Badge>
            </div>
            {account.account_username && (
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Username</span>
                <span className="font-medium">@{account.account_username}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Connected on</span>
              <span className="font-medium">{formatDate(account.created_at)}</span>
            </div>
            {account.expires_at && (
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Token expires</span>
                <span className="font-medium">{formatDate(account.expires_at)}</span>
              </div>
            )}
            {account.scopes && account.scopes.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-muted-foreground">Permissions</span>
                <div className="flex flex-wrap gap-1.5">
                  {account.scopes.map((scope) => (
                    <Badge key={scope} variant="outline" className="font-mono text-[10px]">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {account.extra_data?.whatsapp_number ? (
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">WhatsApp</span>
                <span className="font-medium">{String(account.extra_data.whatsapp_number)}</span>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setManageOpen(false);
                onDisconnect(account.id);
              }}
              disabled={isDisconnecting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Disconnect this account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
