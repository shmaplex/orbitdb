import path from "path";
import { fileURLToPath } from "url";
import type { Configuration } from "webpack";

export default (_env: any, _argv: any): Configuration => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  return {
    mode: "development",
    entry: "./src/index.ts",
    output: {
      filename: "../dist/orbitdb.js",
      library: {
        name: "OrbitDB",
        type: "var",
      },
    },
    target: "web",
    devtool: "source-map",
    externals: {
      fs: "{ existsSync: () => true }",
      mkdirp: "{}",
    },
    resolve: {
      modules: ["node_modules", path.resolve(__dirname, "../node_modules")],
    },
    resolveLoader: {
      modules: ["node_modules", path.resolve(__dirname, "../node_modules")],
      extensions: [".ts", ".js", ".json"],
      mainFields: ["loader", "main"],
    },
  };
};
