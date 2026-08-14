import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getSessionProfile } from "@/lib/auth";

export default async function LoginPage() {
  const { profile } = await getSessionProfile();

  if (profile?.is_active && profile.role === "admin") {
    redirect("/admin");
  }

  if (profile?.is_active && profile.role === "tenant") {
    redirect("/tenant");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
