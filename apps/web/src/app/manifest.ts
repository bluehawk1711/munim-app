import type { MetadataRoute } from "next";

// Served by Next at /manifest.json. Colors mirror the default "apple" accent
// theme (packages/theme/src/tokens.ts): light bg #fcfbf8 / dark bg #080705.
// The manifest allows a single static theme_color, so we use the light value;
// the dark-mode value lives in the viewport metadata's themeColor in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Munim — Shop Management",
    short_name: "Munim",
    description:
      "Unified shop management suite for stock, sales, billing, khata (party advances), job letters, and reports.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fcfbf8",
    theme_color: "#fcfbf8",
    lang: "en",
    categories: ["business", "productivity", "finance"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
