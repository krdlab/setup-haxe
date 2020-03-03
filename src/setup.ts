// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as path from "path";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import { exec } from "@actions/exec";
import { HaxeAsset, HaxeAssetFileExt } from "./asset";

export async function setup(version: string) {
  let toolPath = tc.find("haxe", version);
  if (!toolPath) {
    toolPath = await tc.cacheDir(await download(version), "haxe", version);
  }
  core.addPath(toolPath);
}

async function download(version: string) {
  const asset = new HaxeAsset(version);
  const downloadPath = await tc.downloadTool(asset.downloadUrl);
  const extractPath = await extract(
    downloadPath,
    asset.fileNameWithoutExt,
    asset.fileExt
  );

  const toolRoot = await findToolRoot(extractPath);
  if (!toolRoot) {
    throw new Error(`tool directory not found: ${extractPath}`);
  }
  return toolRoot;
}

function extract(file: string, dest: string, ext: HaxeAssetFileExt) {
  switch (ext) {
    case ".tar.gz":
      return tc.extractTar(file, dest);
    case ".zip":
      return tc.extractZip(file, dest);
    default:
      throw Error(`unknown ext: ${ext}`);
  }
}

// * NOTE: tar xz -C haxe-4.0.5-linux64 -f haxe-4.0.5-linux64.tar.gz --> haxe-4.0.5-linux64/haxe_20191217082701_67feacebc
async function findToolRoot(extractPath: string) {
  let found = false;
  let toolRoot = "";
  await exec("ls", ["-1", extractPath], {
    listeners: {
      stdout: data => {
        const entry = data.toString().trim();
        if (entry.length > 0) {
          toolRoot = path.join(extractPath, entry);
          found = true;
        }
      }
    }
  });
  return found ? toolRoot : null;
}
