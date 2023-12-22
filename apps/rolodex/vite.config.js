import path from "path";
import { glob } from "glob";
import wasm from "vite-plugin-wasm";

export default {
  root: path.join(__dirname, "src"),
  build: {
    target: 'es2022',
    emptyOutDir: false,
    outDir: path.join(__dirname, "public"),
    rollupOptions: {
      input: glob.sync(path.resolve(__dirname, "src", "odd.js")),
      output: {
        entryFileNames: "[name].js",
      },
      preserveEntrySignatures: 'allow-extension',
    },
  },
  resolve: { preserveSymlinks: true },
  plugins: [
    wasm(),
  ] 
};