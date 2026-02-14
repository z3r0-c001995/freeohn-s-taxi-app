const createExpoWebpackConfigAsync = require("@expo/webpack-config");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Ensure wasm extensions are resolved so the expo-sqlite web worker can
  // import `wa-sqlite.wasm`.
  config.resolve.extensions = config.resolve.extensions || [];
  if (!config.resolve.extensions.includes(".wasm")) {
    config.resolve.extensions.push(".wasm");
  }

  config.module.rules.unshift({
    test: /\.wasm$/i,
    type: "asset/resource",
  });

  config.experiments = {
    ...(config.experiments || {}),
    asyncWebAssembly: true,
  };

  return config;
};
