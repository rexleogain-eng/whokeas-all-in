import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WHOKEAS ALL IN",
    short_name: "WHOKEAS",
    description:
      "A global marketplace for technology, home, fashion, study, beauty and lifestyle products.",
    start_url: "/",
    display: "standalone",
    background_color: "#181511",
    theme_color: "#181511",
    icons: [
      {
        src: "/brand/search-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
