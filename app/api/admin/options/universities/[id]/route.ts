import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { log } from "@/lib/logger";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const removed = await sql`DELETE FROM universities WHERE id = ${id} RETURNING *`;
  if (removed.length) {
    await log({ level: "info", event: "option_removed", category: "admin", message: "University removed", actorEmail: session.email, route: "/api/admin/options/universities/[id]", metadata: { type: "university", id: removed[0].id, name: removed[0].name ?? removed[0].label } });
  }
  return NextResponse.json({ ok: true });
}
