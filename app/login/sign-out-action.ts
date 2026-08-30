"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction(loginAs: "admin" | "tenant" = "admin") {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/login?as=${loginAs}`);
}
