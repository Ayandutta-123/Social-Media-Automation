import { PostType } from "@/types";
import { getPostTypeFromNotionProperty } from "@/lib/post-type";

function formatDatabaseId(dbId: string) {
  if (dbId.length === 32 && !dbId.includes("-")) {
    return `${dbId.slice(0, 8)}-${dbId.slice(8, 12)}-${dbId.slice(12, 16)}-${dbId.slice(16, 20)}-${dbId.slice(20)}`;
  }
  return dbId;
}

export async function getNotionPagePostType(
  pageId: string
): Promise<PostType | undefined> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return undefined;

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
    cache: "no-store",
  });

  if (!res.ok) return undefined;

  const page = await res.json();
  const properties = page.properties ?? {};
  return getPostTypeFromNotionProperty(properties["Post type"]);
}

export async function notionPageExists(pageId: string): Promise<boolean> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return false;

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
    cache: "no-store",
  });

  return res.ok;
}

export { formatDatabaseId };
