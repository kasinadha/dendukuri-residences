"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInResult = { ok: false; error: string };

/**
 * Server-side password sign-in so auth cookies are written on the response.
 * Client-only signIn often authenticates in the browser but leaves Server
 * Components without a session (redirect loop → /login?error=session).
 */
export async function signInWithPasswordAction(
  formData: FormData
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError) {
    const msg = signInError.message || "Sign-in failed.";
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(msg)) {
      return {
        ok: false,
        error:
          "Cannot reach Supabase (network/DNS). Check internet, that NEXT_PUBLIC_SUPABASE_URL is correct, and restart the app from Terminal (not a proxied Cursor shell): npm run start -- -p 3100",
      };
    }
    return { ok: false, error: msg };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { ok: false, error: "Login failed. Please try again." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: `Could not load profile (${profileError.message}). Check RLS on profiles.`,
    };
  }

  if (!profile) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        "Signed in to Auth, but no profiles row exists. Insert profiles with role='admin' and is_active=true for this user.",
    };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        "Your profile exists but is_active is false. Set is_active=true in profiles.",
    };
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  if (profile.role === "tenant") {
    redirect("/tenant");
  }

  await supabase.auth.signOut();
  return {
    ok: false,
    error: `Profile role is "${profile.role ?? "unknown"}" — expected "admin" or "tenant".`,
  };
}
