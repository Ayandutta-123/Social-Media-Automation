import { PostType } from "@/types";

export function normalizePostType(raw: string): PostType | undefined {
  const value = raw.trim().toLowerCase();
  if (value === "competitor") return "competitor";
  if (value === "industry" || value === "industry trends") return "industry";
  return undefined;
}

export function getPostTypeFromNotionProperty(prop: unknown): PostType | undefined {
  if (!prop || typeof prop !== "object") return undefined;

  const p = prop as Record<string, unknown>;

  if (p.type === "select" && p.select && typeof p.select === "object") {
    const name = (p.select as { name?: string }).name;
    if (name) return normalizePostType(name);
  }

  if (p.type === "multi_select" && Array.isArray(p.multi_select)) {
    for (const item of p.multi_select) {
      const name = (item as { name?: string }).name;
      const normalized = name ? normalizePostType(name) : undefined;
      if (normalized) return normalized;
    }
  }

  const richText = (p.rich_text || p.title) as Array<{ plain_text?: string }> | undefined;
  if (Array.isArray(richText)) {
    const text = richText.map((t) => t.plain_text || "").join("");
    if (text) return normalizePostType(text);
  }

  return undefined;
}
