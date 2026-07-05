import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import sassGlobImports from 'vite-plugin-sass-glob-import';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    sassGlobImports(),
    react()],
});
