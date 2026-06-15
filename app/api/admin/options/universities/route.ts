import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, country } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!country?.trim()) return NextResponse.json({ error: "Country required" }, { status: 400 });

  try {
    const [row] = await sql`
      INSERT INTO universities (name, country) VALUES (${name.trim()}, ${country.trim()})
      RETURNING id, name, country
    `;
    return NextResponse.json({ university: row }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("23505"))
      return NextResponse.json({ error: "University already exists" }, { status: 409 });
    throw err;
  }
}
