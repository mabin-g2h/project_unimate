import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  try {
    const [row] = await sql`
      INSERT INTO courses (university_id, name) VALUES (${id}, ${name.trim()})
      RETURNING id, name
    `;
    return NextResponse.json({ course: row }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("23505"))
      return NextResponse.json({ error: "Course already exists for this university" }, { status: 409 });
    throw err;
  }
}
