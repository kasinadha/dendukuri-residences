import { headers } from "next/headers";

export async function getSiteOrigin(): Promise<string> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headerList.get("host")?.trim();
  const proto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (host) return `${proto}://${host}`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export async function getTenantLoginUrl(): Promise<string> {
  return `${await getSiteOrigin()}/login?as=tenant`;
}
