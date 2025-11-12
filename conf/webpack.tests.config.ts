import glob from "glob";
import path from "path";
import webpack, { Configuration } from "webpack";
import { fileURLToPath } from "url";
import { createRequire } from "module";

export default (_env: any, _argv: any): Configuration => {
  const require = createRequire(import.meta.url);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  return {
    entry: glob.sync("./test/**/*.ts", { ignore: ["./test/utils/relay.ts"] }),
    output: {
      filename: "../test/browser/bundle.ts",
    },
    target: "web",
    mode: "development",
    devtool: "source-map",
    externals: {
      fs: { existsSync: () => true },
      "fs-extra": { copy: () => {} },
      rimraf: { rimraf: () => {} },
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: "process/browser",
        Buffer: ["buffer", "Buffer"],
      }),
      new webpack.DefinePlugin({
        "process.env.NODE_DEBUG": JSON.stringify(process.env.NODE_DEBUG),
      }),
    ],
    resolve: {
      modules: ["node_modules", path.resolve(__dirname, "../node_modules")],
      fallback: {
        path: require.resolve("path-browserify"),
        crypto: false,
        stream: require.resolve("stream-browserify"),
        process: false,
      },
    },
    resolveLoader: {
      modules: ["node_modules", path.resolve(__dirname, "../node_modules")],
      extensions: [".ts", ".js", ".json"],
      mainFields: ["loader", "main"],
    },
  };
};
