import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(() => {
  const gatewayProxyTarget = process.env.GATEWAY_PROXY_TARGET ?? "http://localhost:8080";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: gatewayProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
      proxy: {
        "/api": {
          target: gatewayProxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      restoreMocks: true,
    },
  };
});
