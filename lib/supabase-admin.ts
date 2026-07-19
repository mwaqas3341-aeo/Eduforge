import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. This uses the service role key, which bypasses Row Level
// Security entirely. Never import this file in a Client Component or
// expose SUPABASE_SERVICE_ROLE_KEY to the browser.
//
// Because all data access in this app goes through Next.js API routes
// (a trusted backend), we enforce ownership checks in application code
// here rather than relying on RLS + `app.current_user_id` per request.
// The RLS policies from 001_schema.sql remain in place as a defense-in-depth
// layer in case a key is ever used directly from a client in the future.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
