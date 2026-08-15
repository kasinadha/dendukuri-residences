import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProfileRole = "admin" | "tenant";

export type AppProfile = {
  id: string;
  role: ProfileRole;
  is_active: boolean;
  full_name: string | null;
};

export type SessionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string | null };
  profile: AppProfile;
};

/**
 * Validates the Auth session with the Supabase Auth server (getUser),
 * then loads the app profile. Prefer this over getClaims() for route protection.
 */
export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,is_active,full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    profile: profile as AppProfile | null,
  };
}

export async function requireAdmin(): Promise<SessionContext> {
  const session = await getSessionProfile();

  if (!session.user) {
    redirect("/login?as=admin&error=session");
  }

  if (
    !session.profile ||
    !session.profile.is_active ||
    session.profile.role !== "admin"
  ) {
    redirect("/login?as=admin&error=unauthorized");
  }

  return {
    supabase: session.supabase,
    user: session.user,
    profile: session.profile,
  };
}

export async function requireTenant(): Promise<SessionContext> {
  const session = await getSessionProfile();

  if (!session.user) {
    redirect("/login?as=tenant&error=session");
  }

  if (
    !session.profile ||
    !session.profile.is_active ||
    session.profile.role !== "tenant"
  ) {
    redirect("/login?as=tenant&error=unauthorized");
  }

  return {
    supabase: session.supabase,
    user: session.user,
    profile: session.profile,
  };
}
