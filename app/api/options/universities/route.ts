import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT u.id, u.name, COALESCE(
      JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'name', c.name) ORDER BY c.name)
        FILTER (WHERE c.id IS NOT NULL),
      '[]'
    ) AS courses
    FROM universities u
    LEFT JOIN courses c ON c.university_id = u.id
    GROUP BY u.id, u.name
    ORDER BY u.name
  `;
  return NextResponse.json({ universities: rows });
}
