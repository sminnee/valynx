const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");

// Combine env vars and .env content into envVarDefines, suitable for the DefinePlugin
// NODE_ENV and env vars staritng with REACT_APP_ will be passed
require("dotenv").config({ path: "./.env.local" });

let includedVars = {};
Object.entries(process.env).forEach(([k, v]) => {
  if (k === "NODE_ENV" || k.match(/^REACT_APP_/)) {
    includedVars[k] = v;
  }
});
const envVarDefines = { ENV_VARS: JSON.stringify(includedVars) };

const paths = {
  appBuild: "build",
  appHtml: "public/index.html",
  appIndexJs: "./src/app/index.tsx",
  appSrc: "src",
  publicUrlOrPath: process.env.PUBLIC_URL || "/",
};

const commonConfig = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              // Skip type checking in development but enable it for production
              // so that the build fails if types are wrong
              transpileOnly: process.env.NODE_ENV === "development",
            },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
          },
        ],
      },
      {
        test: /\.svg$/,
        use: ["@svgr/webpack", "url-loader"],
      },
      {
        test: /\.(png|jpeg|jpg|gif)$/,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "images/[hash]-[name].[ext]",
            },
          },
        ],
      },
    ],
  },

  resolve: {
    modules: ["node_modules", "./src", "./src/theme"],
    extensions: [".tsx", ".ts", ".js", ".jsx", ".scss", ".svg", ".jpg", ".jpeg", ".png"],
  },

  plugins: [
    new webpack.DefinePlugin(envVarDefines),
    new MiniCssExtractPlugin({
      filename: "static/css/[name].[contenthash:8].css",
      chunkFilename: "static/css/[name].[contenthash:8].chunk.css",
      ignoreOrder: true,
    }),
  ],
};

const developmentConfig = {
  ...commonConfig,
  mode: "development",
  devtool: "eval",
  bail: false,
  entry: [paths.appIndexJs],
  output: {
    pathinfo: true,
    filename: "static/js/[name].bundle.js",
    chunkFilename: "static/js/[name].chunk.js",
    publicPath: paths.publicUrlOrPath,
  },
  devServer: {
    static: [path.join(__dirname, "public")],
    compress: true,
    port: 3000,
    historyApiFallback: true,
  },

  plugins: commonConfig.plugins.concat([
    // Generates an `index.html` file with the <script> injected.
    new HtmlWebpackPlugin({
      inject: true,
      template: paths.appHtml,
    }),
  ]),

  module: {
    rules: commonConfig.module.rules.concat([
      {
        test: /\.(js|tsx?)$/,
        use: ["source-map-loader"],
        enforce: "pre",
      },
      {
        test: /\.s[ca]ss$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
              sassOptions: {
                includePaths: ["src/theme"],
              },
            },
          },
        ],
      },
    ]),
  },
  ignoreWarnings: [/Failed to parse source map/],
};

const productionConfig = {
  ...commonConfig,
  module: {
    rules: commonConfig.module.rules.concat([
      {
        test: /\.s[ca]ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
              sassOptions: {
                includePaths: ["src/theme"],
              },
            },
          },
        ],
      },
    ]),
  },
  mode: "production",
  //devtool: 'source-map',
  bail: true,
  output: {
    // The build folder.
    path: path.resolve(paths.appBuild),
    filename: "static/js/[name].[contenthash:8].js",
    chunkFilename: "static/js/[name].[contenthash:8].chunk.js",
    pathinfo: false,
    publicPath: paths.publicUrlOrPath,
    // Point sourcemap entries to src-relative location
    devtoolModuleFilenameTemplate: (info) => path.relative(paths.appSrc, info.absoluteResourcePath), //.replace(/\\/g, '/')
  },
  optimization: {
    minimize: true,
    minimizer: [
      // This is only used in production mode
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8,
          },
          compress: {
            ecma: 5,
            warnings: false,
            // Disabled because of an issue with Uglify breaking seemingly valid code:
            // https://github.com/facebook/create-react-app/issues/2376
            // Pending further investigation:
            // https://github.com/mishoo/UglifyJS2/issues/2011
            comparisons: false,
            // Disabled because of an issue with Terser breaking valid code:
            // https://github.com/facebook/create-react-app/issues/5250
            // Pending further investigation:
            // https://github.com/terser-js/terser/issues/120
            inline: 2,
          },
          mangle: {
            safari10: true,
          },
          // Added for profiling in devtools
          keep_classnames: true,
          keep_fnames: true,
          output: {
            ecma: 5,
            comments: false,
            // Turned on because emoji and regex is not minified properly using default
            // https://github.com/facebook/create-react-app/issues/2488
            ascii_only: true,
          },
        },
        // sourceMap: true,
      }),
      new CssMinimizerPlugin(),
    ],
    splitChunks: {
      chunks: "all",
      name: false,
      minSize: 50000,
    },
    // Keep the runtime chunk separated to enable long term caching
    // https://twitter.com/wSokra/status/969679223278505985
    // https://github.com/facebook/create-react-app/issues/5358
    runtimeChunk: {
      name: (entrypoint) => `runtime-${entrypoint.name}`,
    },
  },
  plugins: commonConfig.plugins.concat([
    // Generates an `index.html` file with the <script> injected.
    new HtmlWebpackPlugin({
      inject: true,
      template: paths.appHtml,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      },
    }),
    new CopyPlugin({
      patterns: [
        {
          from: "public",
          globOptions: {
            ignore: ["**/index.html"],
          },
        },
      ],
    }),
  ]),
};

const config = process.env.NODE_ENV === "production" ? productionConfig : developmentConfig;

module.exports = config;
