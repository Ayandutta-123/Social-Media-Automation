import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { uploadImageBuffer, isCloudinaryConfigured } from "@/lib/cloudinary";
import { triggerCustomImageUpload, CustomImagePostType } from "@/app/actions/n8n";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isValidPostType(value: string): value is CustomImagePostType {
  return value === "competitor" || value === "industry";
}

export async function POST(request: NextRequest) {
  const session = (await cookies()).get("session")?.value;
  if (session !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on the server" },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const postTypeRaw = formData.get("postType");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  if (typeof postTypeRaw !== "string" || !isValidPostType(postTypeRaw)) {
    return NextResponse.json(
      { error: "postType must be competitor or industry" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Image must be 10 MB or smaller" },
      { status: 400 }
    );
  }

  const postType = postTypeRaw as CustomImagePostType;
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const folder = `hyperthings/${postType}/${uploadId}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  let imageUrl: string;
  try {
    imageUrl = await uploadImageBuffer(buffer, folder);
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }

  const n8nResult = await triggerCustomImageUpload({
    postType,
    imageUrl,
  });

  if (!n8nResult.success) {
    return NextResponse.json(
      { error: n8nResult.error ?? "Failed to notify n8n workflow" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, imageUrl });
}
