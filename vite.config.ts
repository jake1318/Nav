import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy API calls during development to the backend (on port 3000)
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
