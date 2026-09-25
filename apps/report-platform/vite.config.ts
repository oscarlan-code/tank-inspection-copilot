import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiOrigin = process.env.REPORT_PLATFORM_VITE_API_ORIGIN ?? "http://127.0.0.1:8788";
const allowedHosts = (process.env.REPORT_PLATFORM_ALLOWED_HOSTS ?? "").split(",").map(host => host.trim()).filter(Boolean);
const apiProxy = {
  "/api": {
    target: apiOrigin,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts,
    port: 4174,
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts,
    port: 4174,
    proxy: apiProxy,
  },
});
