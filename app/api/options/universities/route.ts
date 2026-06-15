import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optional country filter — students see only universities in their chosen
  // destination country. Absent (e.g. admin dropdown manager) returns all.
  const country = req.nextUrl.searchParams.get("country")?.trim();

  const rows = country
    ? await sql`SELECT id, name, country FROM universities WHERE country = ${country} ORDER BY name`
    : await sql`SELECT id, name, country FROM universities ORDER BY name`;
  return NextResponse.json({ universities: rows });
}
