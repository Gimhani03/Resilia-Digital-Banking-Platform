const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watching the whole workspace exhausts the macOS kqueue watcher limit
// (EMFILE). Only the hoisted deps and the shared package are ever bundled.
config.watchFolders = [
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(workspaceRoot, "packages/shared"),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.blockList = [
  /\/\.git\/.*/,
  /\/apps\/api\/.*/,
  /\/apps\/web\/.*/,
  /\/packages\/shared\/dist\/.*/,
];

const sharedEntry = path.resolve(
  workspaceRoot,
  "packages/shared/src/index.ts",
);

// The web app keeps its own React at the workspace root, so packages hoisted
// there would otherwise load a second React instance and break hooks. Resolve
// these from the mobile app's perspective and force every request to match.
const singletons = ["react", "react-dom", "react-native"];
const singletonRoots = new Map(
  singletons.map((name) => [
    name,
    path.dirname(
      require.resolve(`${name}/package.json`, { paths: [projectRoot] }),
    ),
  ]),
);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@resilia/shared") {
    return { filePath: sharedEntry, type: "sourceFile" };
  }

  for (const [name, root] of singletonRoots) {
    if (moduleName !== name && !moduleName.startsWith(`${name}/`)) continue;
    const subpath = moduleName.slice(name.length);
    return context.resolveRequest(
      context,
      subpath ? path.join(root, subpath) : root,
      platform,
    );
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
