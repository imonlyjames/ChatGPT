import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you deploy to GitHub Pages later, set base: "/<repo-name>/"
export default defineConfig({
  plugins: [react()],
});
