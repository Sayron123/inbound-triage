"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORY_BADGE_COLORS,
  CATEGORY_OPTIONS,
} from "@/lib/constants";

type Message = {
  id: string;
  name: string;
  email: string;
  text: string;
  category: string;
  urgency: "high" | "medium" | "low";
  summary: string;
  created_at: string;
};

const urgencyColors = {
  high: "bg-[#DC2626]",
  medium: "bg-[#D97706]",
  low: "bg-[#6B7280]",
};

function UrgencyBadge({ urgency }: { urgency: Message["urgency"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize text-white ${urgencyColors[urgency]}`}
    >
      {urgency}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize text-white ${CATEGORY_BADGE_COLORS[category] ?? CATEGORY_BADGE_COLORS.other}`}
    >
      {category}
    </span>
  );
}

function LoginForm() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) setError(signInError.message);
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4 py-8 text-sm leading-[1.5] text-[#111827] dark:bg-[#0F172A] dark:text-[#E2E8F0]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-8 shadow-sm dark:border-[#1E293B] dark:bg-[#111827]"
      >
        <h1 className="text-2xl font-semibold">Inbound Triage</h1>
        <p className="mt-2 text-[#6B7280] dark:text-[#94A3B8]">
          Sign in to review inbound messages.
        </p>
        <label className="mt-6 block font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-[#111827] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 dark:border-[#1E293B] dark:bg-[#0F172A] dark:text-[#E2E8F0] dark:focus:border-[#38BDF8]"
        />
        <label className="mt-4 block font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-[#111827] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 dark:border-[#1E293B] dark:bg-[#0F172A] dark:text-[#E2E8F0] dark:focus:border-[#38BDF8]"
        />
        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-md bg-[#2563EB] px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#38BDF8] dark:text-[#0F172A] dark:hover:bg-sky-300"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [category, setCategory] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try{
        const { data: { session } } = await supabase.auth.getSession();
        if(isMounted)setUser(session?.user ?? null);
      } finally {
          if(isMounted)setIsLoading(false);
        }
      }
    

    loadSession();
    const { data: { subscription }} = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    let ignore = false; // prevents a stale response from overwriting newer State 

    async function loadMessages() {
      setIsFetching(true);
      setError("");
      // This is the frontend's database connection. The authenticated session
      // is sent by Supabase automatically, so the database RLS policy decides
      // whether this user may read the messages table.
      const { data, error: queryError } = await supabase
        .from("messages")
        .select("id, name, email, text, category, urgency, summary, created_at")
        .order("created_at", { ascending: false }); //sort largest to smallest , newest first 

      if (ignore) return; 
      if (queryError) setError(queryError.message);
      else setMessages((data ?? []) as Message[]);
      setIsFetching(false);
    }

    loadMessages();

    return () => 
    { ignore = true; };
  }, [supabase, user]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const filteredMessages = messages.filter(
    (message) =>
      (category === "all" || message.category === category) &&
      (urgency === "all" || message.urgency === urgency),
  );

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-sm text-[#111827] dark:bg-[#0F172A] dark:text-[#E2E8F0]">
        Loading...
      </main>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-sm leading-[1.5] text-[#111827] dark:bg-[#0F172A] dark:text-[#E2E8F0]">
      <header className="border-b border-[#E5E7EB] bg-white dark:border-[#1E293B] dark:bg-[#0F172A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <h1 className="text-xl font-semibold">Inbound Triage</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-[#E5E7EB] px-4 py-2 font-medium hover:bg-[#F3F4F6] dark:border-[#1E293B] dark:hover:bg-[#1E293B]"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Messages</h2>
          <p className="mt-2 text-[#6B7280] dark:text-[#94A3B8]">
            Review and filter classified inbound messages.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-2 font-medium">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 font-normal outline-none focus:border-[#2563EB] dark:border-[#1E293B] dark:bg-[#111827] dark:focus:border-[#38BDF8]"
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 font-medium">
            Urgency
            <select
              value={urgency}
              onChange={(event) => setUrgency(event.target.value)}
              className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 font-normal outline-none focus:border-[#2563EB] dark:border-[#1E293B] dark:bg-[#111827] dark:focus:border-[#38BDF8]"
            >
              <option value="all">All urgency</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setCategory("all");
              setUrgency("all");
            }}
            className="rounded-md border border-[#E5E7EB] px-4 py-2 font-medium hover:bg-[#F3F4F6] dark:border-[#1E293B] dark:hover:bg-[#1E293B]"
          >
            Clear filters
          </button>
        </div>

        {error && (
          <p className="mb-6 rounded-md bg-red-50 px-4 py-2 text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] bg-white dark:border-[#1E293B] dark:bg-[#111827]">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#6B7280] dark:border-[#1E293B] dark:text-[#94A3B8]">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Urgency</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((message) => (
                <tr
                  key={message.id}
                  tabIndex={0}
                  role="link"
                  onClick={() => router.push(`/messages/${message.id}`)}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/messages/${message.id}`);
                    }
                  }}
                  className="cursor-pointer border-b border-[#E5E7EB] last:border-b-0 hover:bg-[#F3F4F6] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2563EB] dark:border-[#1E293B] dark:hover:bg-[#1E293B] dark:focus:ring-[#38BDF8]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/messages/${message.id}`}
                      className="block font-medium text-[#2563EB] hover:underline dark:text-[#38BDF8]"
                    >
                      {message.name}
                    </Link>
                  </td>
                  <td className="max-w-md px-4 py-3">{message.summary}</td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={message.category} />
                  </td>
                  <td className="px-4 py-3">
                    <UrgencyBadge urgency={message.urgency} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#6B7280] dark:text-[#94A3B8]">
                    {new Date(message.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMessages.length === 0 && (
            <p className="px-4 py-8 text-center text-[#6B7280] dark:text-[#94A3B8]">
              No messages match the selected filters.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
