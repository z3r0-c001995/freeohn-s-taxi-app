// Polyfill toReversed for older Node versions
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = config.resolver.assetExts || [];
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}

// Force CJS entry points for zustand to avoid `import.meta` leaking into
// web bundles served as classic scripts by Metro static export.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  zustand: path.resolve(__dirname, "node_modules/zustand/index.js"),
  "zustand/vanilla": path.resolve(__dirname, "node_modules/zustand/vanilla.js"),
  "zustand/traditional": path.resolve(__dirname, "node_modules/zustand/traditional.js"),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "zustand") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "node_modules/zustand/index.js"),
    };
  }
  if (moduleName === "zustand/vanilla") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "node_modules/zustand/vanilla.js"),
    };
  }
  if (moduleName === "zustand/traditional") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "node_modules/zustand/traditional.js"),
    };
  }
  if (typeof originalResolveRequest === "function") {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add web-specific resolver config to skip native modules on web
config.resolver.blockList = [
  ...config.resolver.blockList,
  /react-native-maps\/lib\/NativeComponentGooglePolygon/,
];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
