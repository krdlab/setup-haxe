// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as path from "path";
import * as os from "os";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import { exec } from "@actions/exec";

// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/4.0.5/haxe-4.0.5-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/3.4.7/haxe-3.4.7-win64.zip

function getPlatform() {
  const plat = os.platform();
  switch (plat) {
    case "linux":
      return "linux";
    case "win32":
      return "win";
    default:
      throw new Error(`${plat} not supported`);
  }
}

function getArch() {
  const arch = os.arch();
  switch (arch) {
    case "x64":
      return "64";
    default:
      throw new Error(`${arch} not supported`);
  }
}

function getTarget() {
  return `${getPlatform()}${getArch()}`;
}

function getFileExt() {
  switch (getPlatform()) {
    case "win":
      return ".zip";
    default:
      return ".tar.gz";
  }
}

function getFileNameWithoutExt(version: string) {
  return `haxe-${version}-${getTarget()}`;
}

function getDownloadUrl(version: string, fileName: string, fileExt: string) {
  return `https://github.com/HaxeFoundation/haxe/releases/download/${version}/${fileName}${fileExt}`;
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

export async function setup(version: string) {
  let toolPath = tc.find("haxe", version);
  if (!toolPath) {
    const fileName = getFileNameWithoutExt(version);
    const downloadPath = await tc.downloadTool(
      getDownloadUrl(version, fileName, getFileExt())
    );
    const extractPath = await tc.extractTar(downloadPath, fileName);
    const toolRoot = await findToolRoot(extractPath);
    if (!toolRoot) {
      throw new Error(`tool directory not found: ${extractPath}`);
    }
    toolPath = await tc.cacheDir(toolRoot, "haxe", version);
  }

  core.addPath(toolPath);
}
