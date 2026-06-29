"use server";

// Next.js Server Actions to securely call n8n webhooks from the client
// without exposing the webhook URLs or potential API keys to the browser.

export async function triggerCompetitorScrape(payload: {
  companyName: string;
  instagramId?: string;
  instagramUrl?: string;
  linkedinId?: string;
  linkedinUrl?: string;
}) {
  const webhookUrl = process.env.N8N_WEBHOOK_COMPETITOR;
  
  if (!webhookUrl) {
    console.warn("N8N_WEBHOOK_COMPETITOR is not set in .env.local");
    return { success: false, error: "Webhook URL not configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`n8n responded with status: ${response.status}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to trigger n8n competitor webhook:", error);
    return { success: false, error: error.message };
  }
}

export async function triggerTrendResearch(id: string) {
  const webhookUrl = process.env.N8N_WEBHOOK_TRENDS;
  
  if (!webhookUrl) {
    console.warn("N8N_WEBHOOK_TRENDS is not set in .env.local");
    return { success: false, error: "Webhook URL not configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      throw new Error(`n8n responded with status: ${response.status}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to trigger n8n trend webhook:", error);
    return { success: false, error: error.message };
  }
}

export type CustomImagePostType = "competitor" | "industry";

export async function triggerCustomImageUpload(payload: {
  postType: CustomImagePostType;
  imageUrl: string;
}) {
  const webhookUrl =
    payload.postType === "competitor"
      ? process.env.N8N_WEBHOOK_IMAGE_UPLOAD_COMPETITOR
      : process.env.N8N_WEBHOOK_IMAGE_UPLOAD_INDUSTRY;

  if (!webhookUrl) {
    const key =
      payload.postType === "competitor"
        ? "N8N_WEBHOOK_IMAGE_UPLOAD_COMPETITOR"
        : "N8N_WEBHOOK_IMAGE_UPLOAD_INDUSTRY";
    console.warn(`${key} is not set in .env`);
    return { success: false, error: "Image upload webhook URL not configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: payload.imageUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n responded with status: ${response.status}`);
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to trigger n8n image upload webhook:", error);
    return { success: false, error: message };
  }
}
