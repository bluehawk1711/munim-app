export async function uploadImageToCloudinary(file, cloudName, uploadPreset) {
    if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary is not configured: set the cloud name and upload preset in your app environment.");
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
        });
    }
    else {
        form.append("file", file);
    }
    form.append("upload_preset", uploadPreset);
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
//# sourceMappingURL=cloudinary.js.map