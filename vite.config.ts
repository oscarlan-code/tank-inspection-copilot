import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { reportBrainDevPlugin } from "./apps/report-platform/server/reportBrainDevPlugin";

export default defineConfig({
  plugins: [react(), viteSingleFile(), reportBrainDevPlugin()],
  build: {
    target: "esnext",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
