import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  try {
    const [row] = await sql`
      INSERT INTO airlines (name) VALUES (${name.trim()})
      RETURNING id, name
    `;
    await log({ level: "info", event: "option_added", category: "admin", message: "Airline added", actorEmail: session.email, route: "/api/admin/options/airlines", metadata: { type: "airline", ...row } });
    return NextResponse.json({ airline: row }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("23505"))
      return NextResponse.json({ error: "Airline already exists" }, { status: 409 });
    throw err;
  }
}
