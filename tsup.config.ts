import { defineConfig } from "tsup";

// Explicitly ignore all native binaries and fsevents
const externals = [
  /\.node$/, // all .node binaries
  /node_modules\/fsevents\/.*/, // entire fsevents folder
  "libp2p",
  "level",
  "multiformats",
  "@ipld/dag-cbor",
  "@libp2p/crypto",
  "@libp2p/interface",
  "@multiformats/multiaddr",
  "it-drain",
  "it-pipe",
  "lru-cache",
  "p-queue",
  "timeout-abort-controller",
  "uint8arrays",
  "fs",
  "path",
];

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  globalName: "OrbitDB",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  target: "es2020",
  tsconfig: "tsconfig.build.json",
  platform: "node",
  external: externals,
  loader: {
    ".node": "file", // optional, just in case
  },
  watch: process.env.NODE_ENV === "development" ? ["src"] : false,
});
