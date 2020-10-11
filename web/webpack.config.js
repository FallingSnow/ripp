const fs = require("fs");
const path = require("path");

const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer")
    .BundleAnalyzerPlugin;
const PreloadWebpackPlugin = require("preload-webpack-plugin");
const ImageminWebpackPlugin = require("imagemin-webpack");
const ImageminSvgo = require("imagemin-svgo");
const CleanWebpackPlugin = require('clean-webpack-plugin');
const WebpackMessages = require('webpack-messages');
const Package = require("./package.json");
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env = {}, argv) => {
    const publicPath =
        argv.mode === "production" ? new URL(Package.homepage).pathname : "/";
    return {
        entry: {
            main: ["normalize.css", "@blueprintjs/core/lib/css/blueprint.css", path.resolve(__dirname, Package.main)]
        },
        optimization: {
            splitChunks: {
                chunks: "all"
            }
        },
        module: {
            rules: [
                {
                    test: /\.jsx?$/,
                    exclude: /node_modules/,
                    loader: "babel-loader"
                },

                // Needed to load normalize.css
                {
                    test: /\.css$/,
                    use: [
                        {
                            loader: "style-loader"
                        },
                        {
                            loader: "css-loader"
                        }
                    ]
                },

                // Load images & make them responsive
                {
                    test: /\.(jpe?g|png)$/i,
                    loader: "responsive-loader",
                    options: {
                        adapter: require("responsive-loader/sharp")
                    }
                },

                // Load fonts
                {
                    test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
                    use: [
                        {
                            loader: "file-loader",
                            options: {
                                name: "[name].[ext]",
                                outputPath: "fonts/"
                            }
                        }
                    ]
                },

                // Load SVG placeholder image
                {
                    test: /\.(gif)|(svg)$/i,
                    use: [
                        {
                            loader: "url-loader",
                            options: {
                                limit: 8192
                            }
                        }
                    ]
                },

                {
                  test: /\.wasm$/i,
                  type: "javascript/auto",
                  loader: "file-loader"
                }
            ]
        },
        output: {
            path: path.resolve(__dirname, "public"),
            publicPath,
            filename: "[name].[hash].js",
            chunkFilename: "[name].[hash].js"
        },
        resolve: {
            extensions: [".js", ".jsx", ".json"]
        },
        plugins: [
            new WebpackMessages(),
            new CopyPlugin([
              {
                from: 'node_modules/libass-wasm/dist/subtitles-octopus-worker.wasm',
              },
              {
                from: 'node_modules/libass-wasm/dist/subtitles-octopus-worker.data',
              },
            ]),
            new HtmlWebpackPlugin({
                title: Package.name,
                meta: {
                    viewport:
                        "width=device-width, initial-scale=1, shrink-to-fit=no"
                }
            }),
            new PreloadWebpackPlugin({
                rel: "prefetch"
            }),
            // new FaviconsWebpackPlugin({
            //     logo: "./src/static/zeus-logo-no_title.png",
            //     inject: true
            // }),
            new webpack.EnvironmentPlugin({
                PUBLIC_PATH: publicPath
            }),
            new ImageminWebpackPlugin({
                // cache: true,
                imageminOptions: {
                    plugins: [
                        // This crazy mess is to remove vector-effect attributes
                        // on SVGs
                        ImageminSvgo({
                            plugins: [
                                {
                                    removeAttrs: {
                                        attrs: "path:vector-effect"
                                    }
                                }
                            ]
                        })
                    ]
                }
            }),
        ].concat(
            argv.mode === "production"
                ? [
                      new CleanWebpackPlugin(['public']),
                      new BundleAnalyzerPlugin({
                          analyzerMode: "static",
                          openAnalyzer: false
                      })
                  ]
                : []
        ),
        devtool: argv.mode === "production"
            ? false
            : "source-map",
        devServer: {
            https: undefined,
            historyApiFallback: true
        }
    };
};
