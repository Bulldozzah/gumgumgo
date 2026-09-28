import { createClient } from "@supabase/supabase-js";

// Same Supabase project as the original app — shared users, roles, data.
const SUPABASE_URL = "https://yyedzpamdmabmxgirnme.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5ZWR6cGFtZG1hYm14Z2lybm1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI5NDUsImV4cCI6MjA3NzM3ODk0NX0.lZKrNNQ2aHWAKDh4PeHnFzzjsOuNwYuQjuAo7-0MKKQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "gumgumgo-auth",
    flowType: "pkce",
  },
});
