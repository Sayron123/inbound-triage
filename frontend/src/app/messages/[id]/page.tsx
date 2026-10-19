"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

const urgencyColors = {
  high: "bg-[#DC2626]",
  medium: "bg-[#D97706]",
  low: "bg-[#6B7280]",
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
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-sm text-[#111827] dark:bg-[#0F172A] dark:text-[#E2E8F0]">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-8 text-sm leading-[1.5] text-[#111827] dark:bg-[#0F172A] dark:text-[#E2E8F0]">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="font-medium text-[#2563EB] hover:underline dark:text-[#38BDF8]"
        >
          Back to messages
        </Link>
        {error ? (
          <p className="mt-6 rounded-md bg-red-50 px-4 py-2 text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : message ? (
          <article className="mt-6 rounded-lg border border-[#E5E7EB] bg-white p-8 dark:border-[#1E293B] dark:bg-[#111827]">
            <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-6 dark:border-[#1E293B] sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">{message.name}</h1>
                <p className="mt-2 text-[#6B7280] dark:text-[#94A3B8]">
                  {message.email}
                </p>
              </div>
              <span
                className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold capitalize text-white ${urgencyColors[message.urgency]}`}
              >
                {message.urgency}
              </span>
            </div>
            <dl className="grid gap-4 border-b border-[#E5E7EB] py-6 sm:grid-cols-2 dark:border-[#1E293B]">
              <div>
                <dt className="text-xs uppercase text-[#6B7280] dark:text-[#94A3B8]">
                  Category
                </dt>
                <dd className="mt-2 capitalize">{message.category}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#6B7280] dark:text-[#94A3B8]">
                  Source
                </dt>
                <dd className="mt-2 capitalize">{message.source}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#6B7280] dark:text-[#94A3B8]">
                  Created
                </dt>
                <dd className="mt-2">
                  {new Date(message.created_at).toLocaleString()}
                </dd>
              </div>
            </dl>
            <section className="border-b border-[#E5E7EB] py-6 dark:border-[#1E293B]">
              <h2 className="text-xs font-semibold uppercase text-[#6B7280] dark:text-[#94A3B8]">
                Summary
              </h2>
              <p className="mt-2">{message.summary}</p>
            </section>
            <section className="pt-6">
              <h2 className="text-xs font-semibold uppercase text-[#6B7280] dark:text-[#94A3B8]">
                Full message
              </h2>
              <p className="mt-2 whitespace-pre-wrap">{message.text}</p>
            </section>
          </article>
        ) : null}
      </div>
    </main>
  );
}

export default function MessageDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-sm text-[#111827] dark:bg-[#0F172A] dark:text-[#E2E8F0]">
          Loading...
        </main>
      }
    >
      <MessageDetailContent />
    </Suspense>
  );
}
