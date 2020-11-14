// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as os from "os";

export type AssetFileExt = ".zip" | ".tar.gz";

export interface Asset {
  readonly name: string;
  readonly version: string;
  readonly downloadUrl: string;
  readonly fileNameWithoutExt: string;
  readonly fileExt: AssetFileExt;
  readonly isDirectoryNested: boolean;
}

abstract class AbstractAsset implements Asset {
  constructor(
    readonly name: string,
    readonly version: string,
    protected readonly env: Env
  ) {}

  abstract get downloadUrl(): string;
  abstract get fileNameWithoutExt(): string;
  abstract get isDirectoryNested(): boolean;

  makeDownloadUrl(path: string) {
    return `https://github.com/HaxeFoundation${path}`;
  }

  get fileExt(): AssetFileExt {
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
export class NekoAsset extends AbstractAsset {
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
export class HaxeAsset extends AbstractAsset {
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
