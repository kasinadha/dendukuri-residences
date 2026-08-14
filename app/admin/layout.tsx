import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Auth server validation + admin role check (redirects if unauthorized).
  await requireAdmin();
  return children;
}
