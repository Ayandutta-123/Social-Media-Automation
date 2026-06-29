import { Client } from "@notionhq/client";

// Initialize the Notion client with the integration token
const notionToken = process.env.NOTION_TOKEN;

export const notion = new Client({
  auth: notionToken || "",
});

// Helper to check if the client is properly configured
export const isNotionConfigured = () => {
  return Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID);
};