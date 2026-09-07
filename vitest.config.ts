import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({ resolve: { alias: [{ find: "server-only", replacement: fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)) }, { find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) }] }, test: { environment: "node", include: ["src/**/*.test.ts"] } });
