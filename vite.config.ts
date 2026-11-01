import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* La landing es lo único que pasa por Vite. admin/, brand/, assets/, vendor/, body3d.js,
   data.js y peptides.js son estáticos: en desarrollo los sirve Vite desde la raíz y al
   publicar los copia el workflow de deploy junto a dist/. */
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
