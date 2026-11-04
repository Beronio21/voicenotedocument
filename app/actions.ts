"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type ConnectionTestRow = {
  message: string | null;
};

export type ConnectionTestResult = {
  message: string | null;
  error: string | null;
};

export async function getConnectionTest(): Promise<ConnectionTestResult> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("connection_tests")
      .select("message")
      .limit(1);

    if (error) {
      console.error("Supabase connection test failed:", error);
      return {
        message: null,
        error: "The Supabase connection test could not be completed.",
      };
    }

    const row = (data?.[0] ?? null) as ConnectionTestRow | null;

    return {
      message: row?.message ?? null,
      error: row ? null : "No connection test row was found.",
    };
  } catch (error) {
    console.error("Supabase client initialization failed:", error);
    return {
      message: null,
      error: "Supabase is not configured for this environment.",
    };
  }
}
