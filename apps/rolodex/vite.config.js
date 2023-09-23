import path from "path";
import { glob } from "glob";

export default {
  root: path.join(__dirname, "src"),
  build: {
    target: 'es2020',
    emptyOutDir: true,
    outDir: path.join(__dirname, "public", "dist"),
    rollupOptions: {
      input: glob.sync(path.resolve(__dirname, "src", "odd.js")),
      output: {
        entryFileNames: "[name].js",
      },
      preserveEntrySignatures: 'allow-extension'
    },
  },
};