import { v2 as cloudinary } from "cloudinary"

// Cloudinary config for server-side signed uploads. Secrets never reach the
// browser — the client posts the file to /api/upload and gets a URL back.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const FOLDER = "stockpilot/products"

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  )
}

export async function uploadImage(
  file: File
): Promise<{ url: string; publicId: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())

  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: FOLDER, resource_type: "image" },
        (error, result) => {
          if (error) reject(error)
          else if (result && typeof result.secure_url === "string" && typeof result.public_id === "string")
            resolve({ secure_url: result.secure_url, public_id: result.public_id })
          else reject(new Error("Upload returned no result"))
        }
      )
      stream.end(buffer)
    }
  )

  return { url: result.secure_url, publicId: result.public_id }
}

// Best-effort delete of a Cloudinary asset from its delivery URL.
export async function destroyImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return
  const publicId = publicIdFromUrl(url)
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch {
    // Never fail the main operation because of cleanup.
  }
}

// https://res.cloudinary.com/<cloud>/image/upload/v1234/products/abc.jpg
//  -> public_id "products/abc"
export function publicIdFromUrl(url: string): string | null {
  const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+)$/)
  if (!match?.[1]) return null
  return match[1].replace(/\.[a-z0-9]+$/i, "")
}
