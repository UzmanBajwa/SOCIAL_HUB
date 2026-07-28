import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { disconnectAccount, fetchAccounts, getConnectUrl } from "@/api/accounts";
import { PlatformIcon } from "@/components/PlatformIcon";
import { AccountCard } from "@/components/accounts/AccountCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { PLATFORM_LABELS, SUPPORTED_PLATFORMS, type Platform } from "@/types";

const OAUTH_COMPLETE_MESSAGE = "socialhub:oauth-complete";

export default function Accounts() {
  const queryClient = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);

  const { data: accounts, isLoading } = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== OAUTH_COMPLETE_MESSAGE) return;

      setConnectingPlatform(null);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: `${PLATFORM_LABELS[event.data.platform as Platform]} connected`,
        variant: "success",
      });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [queryClient]);

  const connectMutation = useMutation({
    mutationFn: async (platform: Platform) => {
      setConnectingPlatform(platform);
      const { authorize_url } = await getConnectUrl(platform);
      const popup = window.open(authorize_url, "socialhub_oauth", "width=560,height=720");
      if (!popup) {
        throw new Error("Your browser blocked the sign-in popup. Please allow popups for this site and try again.");
      }
    },
    onError: (error) => {
      setConnectingPlatform(null);
      toast({ title: "Could not start connection", description: getApiErrorMessage(error, (error as Error).message), variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectAccount,
    onSuccess: () => {
      toast({ title: "Account disconnected", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast({ title: "Could not disconnect", description: getApiErrorMessage(error), variant: "destructive" }),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-muted-foreground">Connect the Facebook Pages and Instagram Business accounts you publish to.</p>
      </div>

      {SUPPORTED_PLATFORMS.map((platform) => {
        const platformAccounts = accounts?.filter((a) => a.platform === platform) ?? [];
        const isConnectingThis = connectMutation.isPending && connectingPlatform === platform;

        return (
          <Card key={platform}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <PlatformIcon platform={platform} />
                <CardTitle className="text-base">{PLATFORM_LABELS[platform]}</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => connectMutation.mutate(platform)}
                disabled={isConnectingThis}
              >
                {isConnectingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {platformAccounts.length ? "Connect another" : "Connect"}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : platformAccounts.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {platformAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onDisconnect={(id) => disconnectMutation.mutate(id)}
                      isDisconnecting={disconnectMutation.isPending && disconnectMutation.variables === account.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No {PLATFORM_LABELS[platform]} account connected yet.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
