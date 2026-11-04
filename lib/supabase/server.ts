import "server-only";

import { createClient } from "@supabase/supabase-js";

function getRequiredEnvironmentVariable(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  fallbackName?: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
) {
  const value = process.env[name] ?? (fallbackName && process.env[fallbackName]);

  if (!value) {
    throw new Error(
      `${name}${fallbackName ? ` or ${fallbackName}` : ""} is not configured.`,
    );
  }

  return value;
}

export function createServerSupabaseClient() {
  const supabaseUrl = getRequiredEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const supabaseKey = getRequiredEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );

  return createClient(supabaseUrl, supabaseKey);
}
