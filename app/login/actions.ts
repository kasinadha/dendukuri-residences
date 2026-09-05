"use server";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { classifyLoginIdentifier } from "@/lib/login-identifier";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tenantLoginEmailCandidates } from "@/lib/tenant-auth";

export type SignInResult = { ok: false; error: string };

async function resolveEmailForSignIn(
  identifier: string
): Promise<{ email: string | null; mobile: string | null; error?: string }> {
  const classified = classifyLoginIdentifier(identifier);

  if (classified.kind === "email" && classified.email) {
    return { email: classified.email, mobile: null };
  }

  if (classified.kind === "mobile" && classified.mobile) {
    const admin = createAdminClient();
    if (!admin.ok) {
      return { email: null, mobile: classified.mobile };
    }

    const { data, error } = await admin.client.rpc("resolve_login_email", {
      identifier: classified.mobile,
    });

    if (error) {
      if (/resolve_login_email|could not find|schema cache/i.test(error.message)) {
        return {
          email: null,
          mobile: classified.mobile,
          error:
            "Mobile login is not set up yet. Run supabase/migrations/20260815_phase10_login_email_or_mobile.sql in Supabase, or sign in with email.",
        };
      }
      return {
        email: null,
        mobile: classified.mobile,
        error: `Could not resolve mobile login (${error.message}).`,
      };
    }

    const email =
      typeof data === "string" && data.trim() ? data.trim().toLowerCase() : null;
    return { email, mobile: classified.mobile };
  }

  return {
    email: null,
    mobile: null,
    error: "Enter a valid email or 10-digit mobile number.",
  };
}

function parseLoginAs(raw: string): "admin" | "tenant" | null {
  const value = raw.trim().toLowerCase();
  if (value === "admin" || value === "tenant") return value;
  return null;
}

/**
 * Server-side password sign-in so auth cookies are written on the response.
 * Accepts email or Indian mobile (via tenants.phone → profile_id → Auth email).
 * Requires login_as=admin|tenant and rejects mismatched profiles.role.
 */
export async function signInWithPasswordAction(
  formData: FormData
): Promise<SignInResult> {
  const identifier = String(
    formData.get("identifier") ?? formData.get("email") ?? ""
  ).trim();
  const password = String(formData.get("password") ?? "").trim();
  const loginAs = parseLoginAs(String(formData.get("login_as") ?? ""));

  if (!loginAs) {
    return {
      ok: false,
      error: "Choose Tenant or Admin before signing in.",
    };
  }

  if (!identifier || !password) {
    return {
      ok: false,
      error: "Email or mobile, and password, are required.",
    };
  }

  const supabase = await createClient();
  const resolved = await resolveEmailForSignIn(identifier);

  if (resolved.error && !resolved.email && !resolved.mobile) {
    return { ok: false, error: resolved.error };
  }

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
    await supabase.auth.signOut({ scope: "local" });
  }

  const loginEmails = resolved.mobile
    ? tenantLoginEmailCandidates(resolved.mobile, resolved.email)
    : resolved.email
      ? [resolved.email]
      : [];

  let signedInUser: User | null = null;
  let signInError: { message: string } | null = null;

  for (const email of loginEmails) {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!result.error && result.data.user) {
      signedInUser = result.data.user;
      signInError = null;
      break;
    }
    signInError = result.error;
  }

  if (signInError || !signedInUser) {
    const msg = signInError?.message || "Sign-in failed.";
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(msg)) {
      return {
        ok: false,
        error:
          "Cannot reach Supabase (network/DNS). Check internet, that NEXT_PUBLIC_SUPABASE_URL is correct, and restart the app from Terminal (not a proxied Cursor shell): npm run start -- -p 3100",
      };
    }
    if (
      resolved.mobile &&
      (/invalid login credentials/i.test(msg) ||
        /phone logins are disabled/i.test(msg))
    ) {
      return {
        ok: false,
        error:
          "Invalid mobile or password. Ask the owner to open Admin → Tenants → Reset password for your name, then try again.",
      };
    }
    return { ok: false, error: msg };
  }

  const userId = signedInUser.id;

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
        "Signed in to Auth, but no profiles row exists. Insert profiles with role='tenant' (or admin) and is_active=true for this user.",
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

  if (profile.role !== loginAs) {
    await supabase.auth.signOut();
    if (loginAs === "admin") {
      return {
        ok: false,
        error:
          "This account is not an admin. Switch to Tenant, or ask the owner to set profiles.role = 'admin'.",
      };
    }
    return {
      ok: false,
      error:
        "This account is not a tenant. Switch to Admin, or ask the owner to set profiles.role = 'tenant' and link tenants.profile_id.",
    };
  }

  if (loginAs === "admin") {
    redirect("/admin");
  }

  redirect("/tenant");
}
