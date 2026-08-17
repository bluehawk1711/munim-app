import {
  BadRequestException,
  Controller,
  Post,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
// Pulls in the @fastify/multipart module augmentation (request.file, isMultipart…).
import type {} from "@fastify/multipart";
import { uploadImageToCloudinarySigned, type CloudinaryCredentials } from "@munim/core";
import { getEnv, isCloudinaryConfigured } from "../config/env.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/upload — multipart form with a "file" field. Proxies the image to
 * Cloudinary (server-side signed upload) and returns { url, publicId } so the
 * client never touches Cloudinary secrets. Mirrors the web app's /api/upload.
 *
 * Requires the @fastify/multipart plugin (registered in main.ts).
 */
@Controller("upload")
export class UploadController {
  @Post()
  async upload(@Req() request: FastifyRequest): Promise<{ url: string; publicId: string }> {
    const env = getEnv();
    if (!isCloudinaryConfigured(env)) {
      throw new ServiceUnavailableException(
        "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to the API environment.",
      );
    }

    const data = await request.file();
    if (!data) {
      throw new BadRequestException("No file provided");
    }
    if (!data.mimetype.startsWith("image/")) {
      throw new BadRequestException("Only image files are allowed");
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException("Image must be 5 MB or smaller");
    }

    const creds: CloudinaryCredentials = {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    };
    const file = new File([buffer], data.filename || "upload.jpg", { type: data.mimetype });

    try {
      const url = await uploadImageToCloudinarySigned(file, creds);
      // https://res.cloudinary.com/<cloud>/image/upload/v1234/<public_id>.<ext>
      const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+)$/);
      const publicId = match?.[1]?.replace(/\.[a-z0-9]+$/i, "") ?? url;
      return { url, publicId };
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : "Upload failed");
    }
  }
}
