// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as os from "os";

// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/4.0.5/haxe-4.0.5-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/3.4.7/haxe-3.4.7-win64.zip

export type HaxeAssetFileExt = ".zip" | ".tar.gz";

export class HaxeAsset {
  constructor(
    private readonly version: string,
    private readonly env = new Env()
  ) {}

  get downloadUrl() {
    return `https://github.com/HaxeFoundation/haxe/releases/download/${this.version}/${this.fileNameWithoutExt}${this.fileExt}`;
  }

  get fileNameWithoutExt() {
    return `haxe-${this.version}-${this.env.haxeTarget}`;
  }

  get fileExt(): HaxeAssetFileExt {
    switch (this.env.platform) {
      case "win":
        return ".zip";
      default:
        return ".tar.gz";
    }
  }
}

class Env {
  get platform() {
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

  get arch() {
    const arch = os.arch();
    switch (arch) {
      case "x64":
        return "64";
      default:
        throw new Error(`${arch} not supported`);
    }
  }

  get haxeTarget() {
    return `${this.platform}${this.arch}`;
  }
}
