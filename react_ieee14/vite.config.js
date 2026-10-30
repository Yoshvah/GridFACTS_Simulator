// Importation de Vite
import { defineConfig } from "vite";

// Plugin React
import react from "@vitejs/plugin-react";

// Plugin Tailwind CSS
import tailwindcss from "@tailwindcss/vite";

// Configuration du projet
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
});