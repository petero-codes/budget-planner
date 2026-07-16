/**
 * Next.js 14 on Windows can throw:
 * Debug Failure. Expected C:/.../tsconfig.json === C:\...\tsconfig.json
 * when building error overlays. Normalize the path before ts.readConfigFile.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "lib",
  "typescript",
  "getTypeScriptConfiguration.js"
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

let source = fs.readFileSync(target, "utf8");
if (source.includes("normalizedTsConfigPath")) {
  process.exit(0);
}

const needle =
  "const formatDiagnosticsHost = {\n            getCanonicalFileName: (fileName)=>fileName,\n            getCurrentDirectory: ts.sys.getCurrentDirectory,\n            getNewLine: ()=>_os.default.EOL\n        };\n        const { config, error } = ts.readConfigFile(tsConfigPath, ts.sys.readFile);";

const replacement =
  '// Windows: normalize so TS SourceFile.fileName matches diagnostic.fileName\n        const normalizedTsConfigPath = tsConfigPath.replace(/\\\\/g, "/");\n        const formatDiagnosticsHost = {\n            getCanonicalFileName: (fileName)=>fileName,\n            getCurrentDirectory: ts.sys.getCurrentDirectory,\n            getNewLine: ()=>_os.default.EOL\n        };\n        const { config, error } = ts.readConfigFile(normalizedTsConfigPath, ts.sys.readFile);';

if (!source.includes(needle)) {
  console.warn(
    "[patch-next-tsconfig-path] Pattern not found; skip (Next may have changed)."
  );
  process.exit(0);
}

source = source.replace(needle, replacement);
fs.writeFileSync(target, source);
console.log("[patch-next-tsconfig-path] Applied Windows tsconfig path fix.");
