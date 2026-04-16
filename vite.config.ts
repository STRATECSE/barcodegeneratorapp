import { defineConfig } from "vite"; // Use vite instead of vitest
import react from "@vitejs/plugin-react-swc";
import path from "path";

const basePath = process.env.VITE_BASE_PATH || "./";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { 
      "@": path.resolve(__dirname, "./src") 
    },
  },
  // Default to relative paths for Electron; can be overridden for GitHub Pages.
  base: basePath,
  build: {
    outDir: 'dist',
    emptyOutDir: true, // Cleans the folder before building
  },
  // You can keep the test block if you are running tests
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
} as any); // 'as any' helps if TypeScript complains about the 'test' key in a Vite config
