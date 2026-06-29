import { NextResponse } from "next/server";
import sql, { isPostgresConfigured } from "@/lib/postgres";
import { mockIndustries } from "@/lib/mock-data";

export async function GET() {
  if (!isPostgresConfigured()) {
    return NextResponse.json(mockIndustries);
  }

  try {
    const industries = await sql`
      SELECT id, name, is_active as "isActive", rotation_order as "rotationOrder", posts_generated as "postsGenerated", last_used as "lastUsed"
      FROM industries
      ORDER BY rotation_order ASC
    `;

    return NextResponse.json(industries);
  } catch (error) {
    console.error("Error fetching industries from Postgres:", error);
    return NextResponse.json(mockIndustries);
  }
}
