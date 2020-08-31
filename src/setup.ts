// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as path from "path";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import { exec } from "@actions/exec";
import { Asset, NekoAsset, HaxeAsset, AssetFileExt, Env, HashLinkAsset } from "./asset";

const env = new Env();

export async function setup(version: string) {
  if (env.platform === "osx") {
    await exec("brew", ["install", "neko"]);
  } else {
    const neko = new NekoAsset("2.3.0"); // ! FIXME: resolve a neko version from the version arg
    const nekoPath = await _setup(neko);
    core.addPath(nekoPath);
    core.exportVariable("NEKO_PATH", nekoPath);
    core.exportVariable("LD_LIBRARY_PATH", `${nekoPath}:$LD_LIBRARY_PATH`);
  }

  const haxe = new HaxeAsset(version);
  const haxePath = await _setup(haxe);
  core.addPath(haxePath);
  await setupHaxeLib(haxePath);

  await setupHashLink();
}

async function setupHashLink(/* TODO: version */) {
  if (env.platform === "win") {
    const hl = new HashLinkAsset("1.11");
    const hlPath = await _setup(hl);
    core.addPath(hlPath);
  } else if (env.platform === "osx") {
    await exec("brew", ["install", "hashlink"]);
  } else {
    // TODO: linux
  }
}

async function _setup(asset: Asset) {
  const toolPath = tc.find(asset.name, asset.version);
  if (!!toolPath) {
    return Promise.resolve(toolPath);
  }
  return await tc.cacheDir(await download(asset), asset.name, asset.version);
}

async function download(asset: Asset) {
  const downloadPath = await tc.downloadTool(asset.downloadUrl);
  const extractPath = await extract(
    downloadPath,
    asset.fileNameWithoutExt,
    asset.fileExt
  );

  const toolRoot = await findToolRoot(extractPath, asset.isDirectoryNested);
  if (!toolRoot) {
    throw new Error(`tool directory not found: ${extractPath}`);
  }
  core.debug(`found toolRoot: ${toolRoot}`);
  return toolRoot;
}

function extract(file: string, dest: string, ext: AssetFileExt) {
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
async function findToolRoot(extractPath: string, nested: boolean) {
  if (!nested) {
    return extractPath;
  }

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

async function setupHaxeLib(toolRoot: string) {
  await exec("haxelib", ["setup", path.join(toolRoot, "lib")]);
  core.exportVariable("HAXE_STD_PATH", path.join(toolRoot, "std"));
}
