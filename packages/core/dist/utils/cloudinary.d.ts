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
export type CloudinaryUploadFile = Blob | {
    uri: string;
    name?: string;
    type?: string;
};
export declare function uploadImageToCloudinary(file: CloudinaryUploadFile, cloudName: string, uploadPreset: string): Promise<string>;
//# sourceMappingURL=cloudinary.d.ts.map