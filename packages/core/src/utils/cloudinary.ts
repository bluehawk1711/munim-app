/**
 * Cloudinary unsigned upload — safe for CLIENT apps (Tauri webview, React
 * Native) because no secret is involved: an unsigned upload preset is public
 * by design (folder restrictions, etc. can be enforced in the preset).
 *
 * The web app keeps its existing server-side signed upload (/api/upload);
 * this helper is for the desktop + mobile apps that have no API server.
 *
 * Accepts either a browser Blob/File or a React Native picker file
 * ({ uri, name, type }) so the exact same helper works on both.
 */
export type CloudinaryUploadFile =
  | Blob
  | { uri: string; name?: string; type?: string };

export async function uploadImageToCloudinary(
  file: CloudinaryUploadFile,
  cloudName: string,
  uploadPreset: string,
): Promise<string> {
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary is not configured: set the cloud name and upload preset in your app environment.",
    );
  }

  const type = file.type;
  if (type && !type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }
  if ("size" in file && typeof file.size === "number" && file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const form = new FormData();
  if ("uri" in file) {
    // React Native: FormData accepts { uri, name, type }.
    form.append("file", {
      uri: file.uri,
      name: file.name ?? `upload-${Date.now()}.jpg`,
      type: file.type ?? "image/jpeg",
    } as unknown as Blob);
  } else {
    form.append("file", file);
  }
  form.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const body = (await res.json().catch(() => null)) as
    | { secure_url?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !body?.secure_url) {
    throw new Error(body?.error?.message ?? `Upload failed (${res.status}).`);
  }
  return body.secure_url;
}
