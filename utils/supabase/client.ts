import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  if (!client) {
    client = createBrowserClient(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseKey || "placeholder-key",
    );
  }
  return client;
};

