"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CategoryBadge, SourceBadge, UrgencyBadge } from "@/components/badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Message = {
  id: string;
  name: string;
  email: string;
  text: string;
  category: string;
  urgency: "high" | "medium" | "low";
  summary: string;
  source: string;
  created_at: string;
};

function MessageDetailContent() {
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [message, setMessage] = useState<Message | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMessage() {
      // SECURITY CHECK: RLS must allow this read only for the authenticated user.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Please sign in to view this message.");
        setIsLoading(false);
        return;
      }

      // The detail page reads the row written by the backend webhook.
      // RLS still applies to this single-row query; the frontend never uses
      // the backend service-role key to bypass Supabase permissions.
      const { data, error: queryError } = await supabase
        .from("messages")
        .select("id, name, email, text, category, urgency, summary, source, created_at")
        .eq("id", params.id)
        .single();

      if (queryError) {
        setError(queryError.message);
      } else {
        setMessage(data as Message);
      }
      setIsLoading(false);
    }

    loadMessage();
  }, [params.id, supabase]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-sm">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-sm">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="font-medium text-primary hover:underline">
          Back to messages
        </Link>
        {error ? (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : message ? (
          <Card className="mt-6">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold">
                  {message.name}
                </CardTitle>
                <p className="mt-2 text-muted-foreground">{message.email}</p>
              </div>
              <UrgencyBadge urgency={message.urgency} />
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <Separator />
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Category
                  </dt>
                  <dd className="mt-2">
                    <CategoryBadge category={message.category} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Source
                  </dt>
                  <dd className="mt-2">
                    <SourceBadge source={message.source} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Created
                  </dt>
                  <dd className="mt-2">
                    {new Date(message.created_at).toLocaleString()}
                  </dd>
                </div>
              </dl>
              <Separator />
              <section>
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                  Summary
                </h2>
                <p className="mt-2">{message.summary}</p>
              </section>
              <Separator />
              <section>
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                  Full message
                </h2>
                <p className="mt-2 whitespace-pre-wrap">{message.text}</p>
              </section>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

export default function MessageDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-sm">
          Loading...
        </main>
      }
    >
      <MessageDetailContent />
    </Suspense>
  );
}
