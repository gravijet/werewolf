import { defineConfig, createLogger } from "vite";
import react from "@vitejs/plugin-react";

const baseLogger = createLogger();
const customLogger = {
  ...baseLogger,
  error(msg, opts) {
    if (typeof msg === "string" && msg.includes("ws proxy socket error")) return;
    baseLogger.error(msg, opts);
  },
};

export default defineConfig({
  plugins: [react()],
  customLogger,
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
        configure: (proxy) => {
          proxy.on("error", () => {});
        },
      },
      "/health": "http://localhost:3000",
    },
  },
});
