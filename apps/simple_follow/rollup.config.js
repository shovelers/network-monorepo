import { nodeResolve } from "@rollup/plugin-node-resolve";
import { wasm } from '@rollup/plugin-wasm';

export default {
  input: "src/crypto_utils.js",
  output: {
    dir: "public/dist",
    sourcemap: true,
    format: 'es',
  },
  plugins: [nodeResolve(), wasm()],
};