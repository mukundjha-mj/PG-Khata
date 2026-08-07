import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const ROOT_ENV_DIR = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  // envDir below covers browser code, but only for VITE_ prefixed values.
  // Nitro loads its own .env relative to this app directory, where there is
  // none, so every server-only secret (Supabase service role, Razorpay keys,
  // the cron secret) arrived undefined and any server function threw. Load the
  // root file into process.env so the server side sees it too.
  //
  // Existing values win: on a host like Vercel the real environment is already
  // populated and must not be overwritten by a stray local file.
  for (const [key, value] of Object.entries(loadEnv(mode, ROOT_ENV_DIR, ""))) {
    process.env[key] ??= value;
  }

  return {
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
      // The app server-renders, so `dist/` alone is not deployable — the host
      // needs a runtime. Nitro turns the SSR build into whatever the platform
      // expects; on Vercel it auto-detects and writes .vercel/output.
      nitro(),
      viteReact(),
    ],
  };
});
