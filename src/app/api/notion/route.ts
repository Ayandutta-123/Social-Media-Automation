import { NextResponse } from "next/server";
import { isNotionConfigured } from "@/lib/notion";
import { getPostTypeFromNotionProperty } from "@/lib/post-type";
import { ContentItem } from "@/types";
import { mockContentItems } from "@/lib/mock-data";

// Helper: extract plain text from a Notion rich_text array
function getText(prop: any): string {
  if (!prop) return "";
  const arr = prop.rich_text || prop.title || [];
  return arr.map((t: any) => t.plain_text).join("") || "";
}

export async function GET() {
  if (!isNotionConfigured()) {
    return NextResponse.json(mockContentItems);
  }

  try {
    const token = process.env.NOTION_TOKEN!;
    let dbId = process.env.NOTION_DATABASE_ID!;

    // Format UUID with hyphens if needed
    if (dbId.length === 32 && !dbId.includes("-")) {
      dbId = `${dbId.slice(0,8)}-${dbId.slice(8,12)}-${dbId.slice(12,16)}-${dbId.slice(16,20)}-${dbId.slice(20)}`;
    }

    // Query Notion directly via fetch (SDK v5 compatibility)
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 50,
      }),
      // Disable caching so we always get fresh data
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Notion API error:", err);
      return NextResponse.json(mockContentItems);
    }

    const data = await res.json();

    // Map Notion properties to ContentItem
    // Actual Notion columns: Topic (title), Instagram caption (rich_text),
    // Linkedin post (rich_text), Status (multi_select), Day Type (rich_text),
    // Image url (rich_text), Posted on (rich_text), Post type (select)
    const posts: ContentItem[] = data.results.map((page: any) => {
      const p = page.properties;

      const topic = getText(p["Topic"]);
      const instagramCaption = getText(p["Instagram caption"]);
      const linkedinPost = getText(p["Linkedin post"]);
      const statusArr = p["Status"]?.multi_select || [];
      const status = statusArr[0]?.name || "Draft";
      const dayType = getText(p["Day Type"]) || "TBD";
      const imageUrl = getText(p["Image url"]) || undefined;
      const postedOn = getText(p["Posted on"]) || "";
      const postType = getPostTypeFromNotionProperty(p["Post type"]);

      // Use Instagram caption as the body preview, fall back to LinkedIn post
      const body = instagramCaption || linkedinPost || "";

      // Determine platform from available content
      let platform = "Instagram + LinkedIn";
      if (instagramCaption && !linkedinPost) platform = "Instagram";
      else if (!instagramCaption && linkedinPost) platform = "LinkedIn";
      // If "Posted on" has a value, use that instead
      if (postedOn) platform = postedOn;

      return {
        id: page.id,
        title: topic,
        body,
        status: status as any,
        platform,
        scheduledDay: dayType,
        imageUrl,
        instagramCaption: instagramCaption || undefined,
        linkedinPost: linkedinPost || undefined,
        postType,
        scheduledAt: page.created_time ?? "",
        createdAt: page.created_time ?? "",
        updatedAt: page.last_edited_time ?? "",
      };
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching from Notion:", error);
    return NextResponse.json(mockContentItems);
  }
}

