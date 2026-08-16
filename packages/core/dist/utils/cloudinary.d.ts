export type CloudinaryUploadFile = Blob | {
    uri: string;
    name?: string;
    type?: string;
};
export type CloudinaryCredentials = {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
};
export declare function uploadImageToCloudinary(file: CloudinaryUploadFile, cloudName: string, uploadPreset: string): Promise<string>;
/** Signed upload — uses the account API key + secret, no preset required.
 *  This is the path the onboarding credentials feed into. */
export declare function uploadImageToCloudinarySigned(file: CloudinaryUploadFile, creds: CloudinaryCredentials): Promise<string>;
//# sourceMappingURL=cloudinary.d.ts.map