import { NextResponse } from "next/server"
import { isCloudinaryConfigured, uploadImage } from "@/lib/cloudinary"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

// POST /api/upload — multipart form with a "file" field.
// Proxies the image to Cloudinary (server-side signed upload) and returns
// { url, publicId } so the client never touches Cloudinary secrets.
export async function POST(request: Request) {
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to your environment.",
      },
      { status: 503 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 400 })
    }

    const result = await uploadImage(file)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error("Upload error:", err)
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })
  }
}
