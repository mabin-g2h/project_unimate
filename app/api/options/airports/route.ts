import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optional country filter — the flight-details ARRIVAL dropdown passes the
  // student's country_of_education to scope airports. Absent (departure dropdown,
  // admin manager) returns all airports.
  const country = req.nextUrl.searchParams.get("country")?.trim();

  const rows = country
    ? await sql`SELECT id, label, country FROM airports WHERE country = ${country} ORDER BY label`
    : await sql`SELECT id, label, country FROM airports ORDER BY label`;
  return NextResponse.json({ airports: rows });
}
