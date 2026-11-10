import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// c941445 was served from https://<user>.github.io/concert_viewing/
export default defineConfig({
  base: process.env.VITE_BASE ?? "/concert_viewing/",
  plugins: [react()],
  assetsInclude: ["**/*.glb"],
});
