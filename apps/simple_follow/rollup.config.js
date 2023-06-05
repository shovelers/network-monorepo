import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "src/crypto_utils.js",
  output: {
    file: "public/javascripts/bundle.js",
    format: 'es',
  },
  plugins: [nodeResolve()],
};