import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // The monorepo keeps environment files at the repository root. Vite still
  // exposes only values prefixed with VITE_ to browser code.
  envDir: "../..",
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            // Vite's preload helper is its own module. Left unassigned it gets
            // folded into whichever chunk is built first — the Supabase one —
            // which gives the entry a static edge back into it and undoes the
            // split below. Must stay ahead of the Supabase group.
            { name: "preload-helper", test: /preload-helper/ },
            // Marketing and the app are one build, and the generated route tree
            // imports every route module eagerly — so without this the Supabase
            // client lands in the shared entry chunk and a visitor reading the
            // pricing page downloads the whole auth client.
            {
              name: "supabase",
              test: /node_modules[\\/]@supabase[\\/]|src[\\/]integrations[\\/]supabase[\\/]client/,
            },
          ],
        },
      },
    },
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
