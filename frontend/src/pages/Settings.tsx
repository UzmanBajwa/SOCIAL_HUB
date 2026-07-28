import { useState } from "react";

import { requestPasswordReset } from "@/api/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { initials } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isSendingReset, setIsSendingReset] = useState(false);

  async function handlePasswordReset() {
    if (!user) return;
    setIsSendingReset(true);
    try {
      await requestPasswordReset(user.email);
      toast({ title: "Reset link sent", description: "Check your email for instructions.", variant: "success" });
    } catch (error) {
      toast({ title: "Could not send reset link", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">{user ? initials(user.name) : ""}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Reset your password via email.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handlePasswordReset} disabled={isSendingReset}>
            {isSendingReset ? "Sending..." : "Send password reset email"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="dark-mode">Dark mode</Label>
          <Switch id="dark-mode" checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </CardContent>
      </Card>
    </div>
  );
}
