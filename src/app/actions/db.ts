"use server";

import sql, { isPostgresConfigured } from "@/lib/postgres";

// INDUSTRIES
export async function addIndustry(name: string) {
  if (!isPostgresConfigured()) {
    // Mock successful insertion
    return { success: true, id: String(Date.now()) };
  }

  try {
    const result = await sql`
      INSERT INTO industries (name, is_active, posts_generated)
      VALUES (${name}, true, 0)
      RETURNING id
    `;
    return { success: true, id: result[0].id };
  } catch (error: any) {
    console.error("Failed to add industry:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteIndustry(id: string) {
  if (!isPostgresConfigured()) return { success: true };

  try {
    await sql`DELETE FROM industries WHERE id = ${id}`;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete industry:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleIndustryStatus(id: string, currentStatus: boolean) {
  if (!isPostgresConfigured()) return { success: true };

  try {
    await sql`
      UPDATE industries
      SET is_active = ${!currentStatus}
      WHERE id = ${id}
    `;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to toggle industry status:", error);
    return { success: false, error: error.message };
  }
}


// COMPETITORS
export async function addCompetitor(name: string, platform: string, handleUrl: string) {
  if (!isPostgresConfigured()) {
    return { success: true, id: String(Date.now()) };
  }

  try {
    const result = await sql`
      INSERT INTO competitors (name, platform, handle_url, status, posts_tracked)
      VALUES (${name}, ${platform}, ${handleUrl}, 'Active', 0)
      RETURNING id
    `;
    return { success: true, id: result[0].id };
  } catch (error: any) {
    console.error("Failed to add competitor:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteCompetitor(id: string) {
  if (!isPostgresConfigured()) return { success: true };

  console.log("Attempting to delete competitor with ID:", id);

  try {
    const result = await sql`DELETE FROM competitors WHERE id = ${id} RETURNING id`;
    console.log("Delete result:", result);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete competitor:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleCompetitorStatus(id: string, currentStatus: string) {
  if (!isPostgresConfigured()) return { success: true };

  try {
    const newStatus = currentStatus === "Active" ? "Paused" : "Active";
    await sql`
      UPDATE competitors
      SET status = ${newStatus}
      WHERE id = ${id}
    `;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to toggle competitor status:", error);
    return { success: false, error: error.message };
  }
}
