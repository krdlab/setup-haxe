// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as path from "path";
import * as os from "os";
import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";
import { exec } from "@actions/exec";

export type AssetFileExt = ".zip" | ".tar.gz";

abstract class Asset {
  constructor(
    readonly name: string,
    readonly version: string,
    protected readonly env: Env
  ) {}

  async setup() {
    const toolPath = tc.find(this.name, this.version);
    if (!!toolPath) {
      return Promise.resolve(toolPath);
    }
    return await tc.cacheDir(await this.download(), this.name, this.version);
  }

  private async download() {
    const downloadPath = await tc.downloadTool(this.downloadUrl);
    const extractPath = await this.extract(
      downloadPath,
      this.fileNameWithoutExt,
      this.fileExt
    );

    const toolRoot = await this.findToolRoot(extractPath, this.isDirectoryNested);
    if (!toolRoot) {
      throw new Error(`tool directory not found: ${extractPath}`);
    }
    core.debug(`found toolRoot: ${toolRoot}`);
    return toolRoot;
  }

  private extract(file: string, dest: string, ext: AssetFileExt) {
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
  private async findToolRoot(extractPath: string, nested: boolean) {
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

  protected abstract get downloadUrl(): string;
  protected abstract get fileNameWithoutExt(): string;
  protected abstract get isDirectoryNested(): boolean;

  protected makeDownloadUrl(path: string) {
    return `https://github.com/HaxeFoundation${path}`;
  }

  protected get fileExt(): AssetFileExt {
    switch (this.env.platform) {
      case "win":
        return ".zip";
      default:
        return ".tar.gz";
    }
  }
}

// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-3-0/neko-2.3.0-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-3-0/neko-2.3.0-osx64.tar.gz
// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-3-0/neko-2.3.0-win64.zip
export class NekoAsset extends Asset {
  constructor(version: string, env = new Env()) {
    super("neko", version, env);
  }

  get downloadUrl() {
    const tag = `v${this.version.replace(/\./g, "-")}`;
    return super.makeDownloadUrl(
      `/neko/releases/download/${tag}/${this.fileNameWithoutExt}${this.fileExt}`
    );
  }

  get target() {
    return `${this.env.platform}${this.env.arch}`;
  }

  get fileNameWithoutExt() {
    return `neko-${this.version}-${this.target}`;
  }

  get isDirectoryNested() {
    return true;
  }
}

// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/4.0.5/haxe-4.0.5-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/3.4.7/haxe-3.4.7-win64.zip
export class HaxeAsset extends Asset {
  constructor(version: string, env = new Env()) {
    super("haxe", version, env);
  }

  get downloadUrl() {
    return super.makeDownloadUrl(
      `/haxe/releases/download/${this.version}/${this.fileNameWithoutExt}${this.fileExt}`
    );
  }

  get target() {
    if (this.env.platform === "osx") {
      return `${this.env.platform}`;
    } else {
      return `${this.env.platform}${this.env.arch}`;
    }
  }

  get fileNameWithoutExt() {
    return `haxe-${this.version}-${this.target}`;
  }

  get isDirectoryNested() {
    return true;
  }
}

export class Env {
  get platform() {
    const plat = os.platform();
    switch (plat) {
      case "linux":
        return "linux";
      case "win32":
        return "win";
      case "darwin":
        return "osx";
      default:
        throw new Error(`${plat} not supported`);
    }
  }

  get arch() {
    const arch = os.arch();
    switch (arch) {
      case "x64":
        return "64";
      default:
        throw new Error(`${arch} not supported`);
    }
  }
}
