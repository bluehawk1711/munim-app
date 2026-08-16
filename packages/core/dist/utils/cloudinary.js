/**
 * Cloudinary upload helpers for the CLIENT apps (Tauri webview, React Native)
 * that have no API server.
 *
 * Two flavours:
 *  - `uploadImageToCloudinary` — unsigned upload via a PUBLIC upload preset
 *    (no secret involved). Used when only a preset is configured.
 *  - `uploadImageToCloudinarySigned` — signed upload using the account's
 *    API key + API secret (no preset needed). The signature is SHA-1 over
 *    `timestamp + apiSecret` (pure TS — works on Hermes/WebView/Node), so the
 *    onboarding screen's Cloudinary credentials are actually used.
 *
 * The web app keeps its own server-side signed upload (/api/upload).
 *
 * Both accept either a browser Blob/File or a React Native picker file
 * ({ uri, name, type }) so the exact same helper works on desktop + mobile.
 */
import { sha1Hex } from "../security/pin.js";
function appendFormFile(form, file) {
    if ("uri" in file) {
        // React Native: FormData accepts { uri, name, type }.
        form.append("file", {
            uri: file.uri,
            name: file.name ?? `upload-${Date.now()}.jpg`,
            type: file.type ?? "image/jpeg",
        });
    }
    else {
        form.append("file", file);
    }
}
function validateFile(file) {
    const type = file.type;
    if (type && !type.startsWith("image/")) {
        throw new Error("Only image files are allowed.");
    }
    if ("size" in file && typeof file.size === "number" && file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be 5 MB or smaller.");
    }
}
async function postUpload(cloudName, form) {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: form,
    });
    const body = (await res.json().catch(() => null));
    if (!res.ok || !body?.secure_url) {
        throw new Error(body?.error?.message ?? `Upload failed (${res.status}).`);
    }
    return body.secure_url;
}
export async function uploadImageToCloudinary(file, cloudName, uploadPreset) {
    if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary is not configured: set the cloud name and upload preset in your app environment.");
    }
    validateFile(file);
    const form = new FormData();
    appendFormFile(form, file);
    form.append("upload_preset", uploadPreset);
    return postUpload(cloudName, form);
}
/** Signed upload — uses the account API key + secret, no preset required.
 *  This is the path the onboarding credentials feed into. */
export async function uploadImageToCloudinarySigned(file, creds) {
    const { cloudName, apiKey, apiSecret } = creds;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary is not configured: set the cloud name, API key and API secret in onboarding / Settings.");
    }
    validateFile(file);
    // Cloudinary signed-upload signature: SHA-1 over the sorted params string
    // (`timestamp=…`) concatenated with the API secret. Pure TS, no WebCrypto.
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sha1Hex(`timestamp=${timestamp}${apiSecret}`);
    const form = new FormData();
    appendFormFile(form, file);
    form.append("api_key", apiKey);
    form.append("timestamp", timestamp);
    form.append("signature", signature);
    return postUpload(cloudName, form);
}
//# sourceMappingURL=cloudinary.js.map