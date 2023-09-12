import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "src/odd.js",
  output: {
    dir: "public/dist",
    sourcemap: true,
    format: 'es',
  },
  plugins: [nodeResolve()],
};
