import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { buildExportCsv, parseExportFilters } from "@/lib/export-data";

export async function GET(request: Request) {
  const session = await getSessionProfile();

  if (
    !session.user ||
    !session.profile?.is_active ||
    session.profile.role !== "admin"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseExportFilters(searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { filename, csv } = await buildExportCsv(session.supabase, parsed);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
