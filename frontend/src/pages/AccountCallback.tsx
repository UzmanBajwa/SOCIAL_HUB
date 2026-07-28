import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { completeConnect, selectPage } from "@/api/accounts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api";
import { initials } from "@/lib/utils";
import type { PageCandidate, Platform } from "@/types";

type Status = "connecting" | "selecting" | "success" | "error";

const OAUTH_COMPLETE_MESSAGE = "socialhub:oauth-complete";

export default function AccountCallback() {
  const { platform } = useParams<{ platform: Platform }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageCandidate[]>([]);
  const [selectionToken, setSelectionToken] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const hasRun = useRef(false);
  const isPopup = Boolean(window.opener);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const providerError = searchParams.get("error");

    if (providerError) {
      setError("The platform denied access or the connection was cancelled.");
      setStatus("error");
      return;
    }

    if (!platform || !code) {
      setError("Missing authorization code.");
      setStatus("error");
      return;
    }

    completeConnect(platform, code, state)
      .then((result) => {
        if (result.requires_selection && result.selection && result.selection_token) {
          setPages(result.selection.pages);
          setSelectionToken(result.selection_token);
          setStatus("selecting");
        } else {
          finish();
        }
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, "Could not connect this account."));
        setStatus("error");
      });
  }, [platform, searchParams]);

  function finish() {
    setStatus("success");
    if (isPopup && platform) {
      window.opener?.postMessage({ type: OAUTH_COMPLETE_MESSAGE, platform, success: true }, window.location.origin);
      setTimeout(() => window.close(), 900);
    }
  }

  async function handleSelectPage(pageId: string) {
    if (!platform || !selectionToken) return;
    setIsSelecting(true);
    try {
      await selectPage(platform, selectionToken, pageId);
      finish();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not finish connecting this page."));
      setStatus("error");
    } finally {
      setIsSelecting(false);
    }
  }

  if (status === "selecting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Choose a page to connect</CardTitle>
            <CardDescription>
              {platform === "instagram"
                ? "Pick which Instagram Business account to publish to."
                : "Pick which Facebook Page to publish to."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                disabled={isSelecting}
                onClick={() => handleSelectPage(page.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={page.avatar_url ?? undefined} alt={page.name} />
                  <AvatarFallback>{initials(page.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{page.name}</p>
                  {(page.username || page.category) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {page.username ? `@${page.username}` : page.category}
                    </p>
                  )}
                </div>
                {isSelecting && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>
            {status === "connecting" && "Connecting account..."}
            {status === "success" && "Connected!"}
            {status === "error" && "Connection failed"}
          </CardTitle>
          <CardDescription>
            {status === "connecting" && "Finishing up with the platform, one moment."}
            {status === "success" && (isPopup ? "This window will close automatically." : "Your account is ready to publish to.")}
            {status === "error" && error}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "error" && !isPopup && (
            <Button asChild className="w-full">
              <Link to="/accounts">Back to accounts</Link>
            </Button>
          )}
          {status === "error" && isPopup && (
            <Button className="w-full" onClick={() => window.close()}>
              Close this window
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
