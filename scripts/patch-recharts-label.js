/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "node_modules/recharts/package.json"));
if (!String(packageJson.version).startsWith("3.")) {
  throw new Error(`Unsupported Recharts version ${packageJson.version}; review the Label import patch before building.`);
}

function patchFile(relativePath, patch) {
  const file = path.join(root, "node_modules/recharts", relativePath);
  if (!fs.existsSync(file)) throw new Error(`Expected Recharts module not found: ${relativePath}`);
  const original = fs.readFileSync(file, "utf8");
  const updated = patch(original);
  if (updated === null) return;
  if (updated === original) throw new Error(`Could not safely patch Recharts ${relativePath}; its module layout changed.`);
  fs.writeFileSync(file, updated);
}

const separateHelper = fs.existsSync(path.join(root, "node_modules/recharts/es6/cartesian/cartesianViewBoxToTrapezoid.js"));
const contextExportsHelper = fs.readFileSync(path.join(root, "node_modules/recharts/es6/context/chartLayoutContext.js"), "utf8").includes("export function cartesianViewBoxToTrapezoid");
if (!separateHelper && !contextExportsHelper) throw new Error("Recharts helper layout is unsupported; refusing an unresolved import.");

patchFile("es6/component/Label.js", (source) => {
  const broken = "import { cartesianViewBoxToTrapezoid, useViewBox } from '../context/chartLayoutContext';";
  const fixed = "import { useViewBox } from '../context/chartLayoutContext';\nimport { cartesianViewBoxToTrapezoid } from '../cartesian/cartesianViewBoxToTrapezoid';";
  if (!separateHelper) {
    if (source.includes(broken)) return null;
    return source.includes(fixed) ? source.replace(fixed, broken) : source;
  }
  if (source.includes(fixed)) return null;
  if (!source.includes(broken)) return source.includes("cartesianViewBoxToTrapezoid") && source.includes("../cartesian/cartesianViewBoxToTrapezoid") ? null : source;
  return source.replace(broken, fixed);
});

patchFile("lib/component/Label.js", (source) => {
  const alias = "var _cartesianViewBoxToTrapezoid = require(\"../cartesian/cartesianViewBoxToTrapezoid\");";
  const brokenImport = 'var _chartLayoutContext = require("../context/chartLayoutContext");';
  if (!separateHelper) {
    if (!source.includes(alias)) return null;
    return source.replace(alias, "").replaceAll("_cartesianViewBoxToTrapezoid.cartesianViewBoxToTrapezoid", "_chartLayoutContext.cartesianViewBoxToTrapezoid");
  }
  if (source.includes(alias)) return null;
  if (!source.includes(brokenImport)) return source.includes("cartesianViewBoxToTrapezoid") && source.includes("../cartesian/cartesianViewBoxToTrapezoid") ? null : source;
  const withImport = source.replace(brokenImport, `${brokenImport}\n${alias}`);
  return withImport.replaceAll("_chartLayoutContext.cartesianViewBoxToTrapezoid", "_cartesianViewBoxToTrapezoid.cartesianViewBoxToTrapezoid");
});

console.log(`Applied the Recharts Label import fix for ${packageJson.version}.`);
