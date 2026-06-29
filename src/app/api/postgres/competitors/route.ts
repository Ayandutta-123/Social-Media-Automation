import { NextResponse } from "next/server";
import sql, { isPostgresConfigured } from "@/lib/postgres";
import { mockCompetitors } from "@/lib/mock-data";

export async function GET() {
  if (!isPostgresConfigured()) {
    // Fallback to mock data if Postgres is not configured yet
    return NextResponse.json(mockCompetitors);
  }

  try {
    // Query the database for competitors.
    // Ensure your table name is 'competitors' and matches this schema.
    const competitors = await sql`
      SELECT id, name, platform, handle_url as "handleOrUrl", status, last_scraped as "lastScraped", posts_tracked as "postsTracked"
      FROM competitors
      ORDER BY name ASC
    `;

    return NextResponse.json(competitors);
  } catch (error) {
    console.error("Error fetching from Postgres:", error);
    // Return mock data gracefully if the query fails (e.g., table doesn't exist yet)
    return NextResponse.json(mockCompetitors);
  }
}
