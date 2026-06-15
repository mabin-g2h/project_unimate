import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optional country filter — students see only cities in their chosen
  // destination country. Absent (e.g. admin dropdown manager) returns all.
  const country = req.nextUrl.searchParams.get("country")?.trim();

  const rows = country
    ? await sql`SELECT id, label, country FROM cities WHERE country = ${country} ORDER BY label`
    : await sql`SELECT id, label, country FROM cities ORDER BY label`;
  return NextResponse.json({ cities: rows });
}
