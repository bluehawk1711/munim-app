/**
 * Feature switches shared by every app.
 *
 * `PRODUCT_IMAGES_ENABLED` — product photos are intentionally OFF for now.
 *
 * The shop doesn't need product images yet; they will be added in a future
 * release. The upload inputs, previews and thumbnails are therefore hidden in
 * web, desktop and mobile — their code is kept intact, so flipping this flag
 * to `true` brings the whole image feature back everywhere without restoring
 * anything. Do NOT delete the image UI: it is parked, not removed.
 */
export const PRODUCT_IMAGES_ENABLED = false;
