"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_OPTIONS, SOURCE_OPTIONS } from "@/lib/constants";
import { CategoryBadge, SourceBadge, UrgencyBadge } from "@/components/badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const URGENCY_OPTIONS = ["high", "medium", "low"] as const;

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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-sm">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Inbound Triage</CardTitle>
          <CardDescription>Sign in to review inbound messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-44 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((item) => (
            <SelectItem key={item} value={item} className="capitalize">
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
  const [source, setSource] = useState("all");
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
      if(!session) setMessages([]);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) {
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
        .select("id, name, email, text, category, urgency, summary, source, created_at")
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
      (urgency === "all" || message.urgency === urgency) &&
      (source === "all" || message.source === source),
  );

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-sm">
        Loading...
      </main>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <main className="min-h-screen bg-background text-sm">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <h1 className="text-xl font-semibold">Inbound Triage</h1>
          <Button type="button" variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Messages</h2>
          <p className="mt-2 text-muted-foreground">
            Review and filter classified inbound messages.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            allLabel="All categories"
            options={CATEGORY_OPTIONS}
          />
          <FilterSelect
            label="Urgency"
            value={urgency}
            onChange={setUrgency}
            allLabel="All urgency"
            options={URGENCY_OPTIONS}
          />
          <FilterSelect
            label="Source"
            value={source}
            onChange={setSource}
            allLabel="All sources"
            options={SOURCE_OPTIONS}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCategory("all");
              setUrgency("all");
              setSource("all");
            }}
          >
            Clear filters
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="py-0">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.map((message) => (
                <TableRow
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
                  className="cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
                >
                  <TableCell>
                    <Link
                      href={`/messages/${message.id}`}
                      className="block font-medium text-primary hover:underline"
                    >
                      {message.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {message.summary}
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={message.category} />
                  </TableCell>
                  <TableCell>
                    <UrgencyBadge urgency={message.urgency} />
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={message.source} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(message.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredMessages.length === 0 && (
            <p className="px-4 py-8 text-center text-muted-foreground">
              No messages match the selected filters.
            </p>
          )}
        </Card>
      </section>
    </main>
  );
}
