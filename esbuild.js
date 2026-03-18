const esbuild = require("esbuild");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");
const autoprefixer = require("autoprefixer");
const fs = require("fs");
const path = require("path");

const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");
const isWebview = process.argv.includes("--webview");

/** PostCSS + Tailwind CSS plugin for esbuild */
const postcssPlugin = {
  name: "postcss",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await fs.promises.readFile(args.path, "utf8");
      const result = await postcss([
        tailwindcss(path.resolve(__dirname, "tailwind.config.js")),
        autoprefixer,
      ]).process(css, { from: args.path });
      return { contents: result.css, loader: "css" };
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: !isProduction,
  minify: isProduction,
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: ["src/webview/index.tsx"],
  bundle: true,
  outfile: "dist/webview.js",
  format: "iife",
  platform: "browser",
  target: "es2022",
  sourcemap: !isProduction,
  minify: isProduction,
  plugins: [postcssPlugin],
  define: {
    "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
  },
};

async function build() {
  try {
    if (isWatch) {
      if (isWebview) {
        const webviewCtx = await esbuild.context(webviewConfig);
        await webviewCtx.watch();
        console.log("[webview] watching...");
      } else {
        const extCtx = await esbuild.context(extensionConfig);
        await extCtx.watch();
        console.log("[extension] watching...");
      }
    } else {
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(webviewConfig),
      ]);
      console.log("Build complete.");
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

build();
