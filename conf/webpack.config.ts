import path from "path";
import { fileURLToPath } from "url";
import type { Configuration } from "webpack";
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";
import webpack from "webpack";
import { createRequire } from "module";

export default (_env: any, _argv: any): Configuration => {
  const require = createRequire(import.meta.url);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  return {
    mode: "production",
    entry: path.resolve(__dirname, "../src/index.ts"),
    output: {
      path: path.resolve(__dirname, "../dist"),
      filename: "orbitdb.min.js",
      library: {
        name: "OrbitDB",
        type: "var",
      },
      clean: true,
    },
    target: "web",
    resolve: {
      extensions: [".ts", ".js", ".json"],
      fallback: {
        fs: false,
        path: require.resolve("path-browserify"),
        events: require.resolve("events/"),
        stream: require.resolve("stream-browserify"),
        crypto: require.resolve("crypto-browserify"),
        buffer: require.resolve("buffer/"),
        process: require.resolve("process/browser"),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(__dirname, "../tsconfig.build.json"),
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    resolveLoader: {
      modules: ["node_modules", path.resolve(__dirname, "../node_modules")],
      extensions: [".ts", ".js", ".json"],
      mainFields: ["loader", "main"],
    },
    plugins: [
      new NodePolyfillPlugin(),
      // Rewrites node:events -> events at build time
      new webpack.NormalModuleReplacementPlugin(/^node:(.+)$/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
    ],
    devtool: "source-map",
    externals: {
      fs: "commonjs fs",
      "fs-extra": "commonjs fs-extra",
      rimraf: "commonjs rimraf",
    },
  };
};
