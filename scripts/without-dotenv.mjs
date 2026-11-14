// Preload for isolated Next commands. Next normally discovers .env files even
// when every required credential is already supplied. Hide those paths before
// discovery, so private environment files are never opened by this process.
import fs from "node:fs";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
const original = fs.statSync;
fs.statSync = function (file, ...args) {
  if (typeof file === "string" && /^\.env(?:\..*)?$/.test(path.basename(file))) {
    const error = new Error("Environment file discovery disabled for isolated commands");
    error.code = "ENOENT";
    throw error;
  }
  return original.call(this, file, ...args);
};
syncBuiltinESMExports();
