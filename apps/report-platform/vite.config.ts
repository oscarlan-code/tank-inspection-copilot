import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:8788",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4174,
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
    proxy: apiProxy,
  },
});
