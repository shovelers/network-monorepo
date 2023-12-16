import path from "path";
import { glob } from "glob";
import wasm from "vite-plugin-wasm";
// import topLevelAwait from "vite-plugin-top-level-await";

export default {
  root: path.join(__dirname, "src"),
  build: {
    target: 'es2022',
    emptyOutDir: true,
    outDir: path.join(__dirname, "public"),
    rollupOptions: {
      input: glob.sync(path.resolve(__dirname, "src", "browser.js")),
      output: {
        entryFileNames: "[name].js",
      },
      preserveEntrySignatures: 'allow-extension'
    },
  },
  plugins: [
    wasm(),
    // topLevelAwait()
  ]
};