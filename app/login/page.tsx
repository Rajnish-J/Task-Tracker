"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signIn } from "@/lib/auth-client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const callbackURL = searchParams.get("redirect") || "/";

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await signIn.social({ provider: "google", callbackURL });
    if (error) {
      setLoading(false);
    }
    // On success the browser is redirected to Google, so no further work here.
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayoutDashboard className="size-5" />
          </div>
          <CardTitle className="text-xl">Welcome to Task Tracker</CardTitle>
          <CardDescription>
            Sign in with Google to access your projects and boards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={handleGoogle}
            disabled={loading}
          >
            <GoogleIcon />
            {loading ? "Redirecting…" : "Continue with Google"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
