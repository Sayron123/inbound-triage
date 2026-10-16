import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Next may prerender client components during a build. Fail when the browser
    // actually needs Supabase, while keeping the build diagnostic actionable.
    if (typeof window !== "undefined") {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );
    }
    return createBrowserClient("http://localhost", "build-placeholder");
  }

  // The frontend intentionally uses only the public anon key. Supabase Auth
  // and RLS enforce which logged-in users can read messages; the service-role
  // key remains server-side in the backend.
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};