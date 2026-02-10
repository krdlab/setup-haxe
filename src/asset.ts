// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Buffer } from 'node:buffer';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as process from 'node:process';
import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import { exec } from '@actions/exec';

export type AssetFileExt = '.zip' | '.tar.gz';

abstract class Asset {
  constructor(readonly name: string, readonly version: string, protected readonly env: Env) {}

  async setup() {
    const toolPath = tc.find(this.name, this.version);
    if (toolPath) {
      return toolPath;
    }

    return tc.cacheDir(await this.download(), this.name, this.version);
  }

  protected abstract get downloadUrl(): string;
  protected abstract get fileNameWithoutExt(): string;
  protected abstract get isDirectoryNested(): boolean;

  protected makeDownloadUrl(path: string) {
    return `https://github.com/HaxeFoundation${path}`;
  }

  protected get fileExt(): AssetFileExt {
    switch (this.env.platform) {
      case 'win': {
        return '.zip';
      }

      default: {
        return '.tar.gz';
      }
    }
  }

  private async download() {
    const downloadPath = await this.downloadWithCurl(this.downloadUrl);
    const extractPath = await this.extract(downloadPath, this.fileNameWithoutExt, this.fileExt);

    const toolRoot = await this.findToolRoot(extractPath, this.isDirectoryNested);
    if (!toolRoot) {
      throw new Error(`tool directory not found: ${extractPath}`);
    }

    core.debug(`found toolRoot: ${toolRoot}`);
    return toolRoot;
  }

  // Use curl because the toolkit's http-client does not support relative redirects.
  // see: https://github.com/actions/toolkit/blob/d47594b53638f7035a96b5ec1ed1e6caae66ee8d/packages/http-client/src/index.ts#L399-L405
  private async downloadWithCurl(url: string) {
    const validUrl = new URL(url);
    const dest = path.join(this.getTempDir(), crypto.randomUUID());
    core.debug(`downloading ${validUrl.toString()} to ${dest}`);

    let stderr = '';
    const exitCode = await exec('curl', ['-fsSL', '-o', dest, validUrl.toString()], {
      ignoreReturnCode: true,
      listeners: {
        stderr(data: Buffer) {
          stderr += data.toString();
        },
      },
    });

    if (exitCode !== 0) {
      const message = stderr.trim() || 'curl exited with a non-zero status but produced no error output.';
      throw new Error(`Failed to download asset from ${url} (curl exit code ${exitCode}): ${message}`);
    }

    return dest;
  }

  private getTempDir() {
    // See: https://docs.github.com/en/actions/reference/workflows-and-actions/variables
    const temporary = process.env.RUNNER_TEMP ?? os.tmpdir();
    core.debug(`temporary directory: ${temporary}`);
    return temporary;
  }

  private async extract(file: string, dest: string, ext: AssetFileExt) {
    if (fs.existsSync(dest)) {
      fs.rmdirSync(dest, { recursive: true });
    }

    switch (ext) {
      case '.tar.gz': {
        return tc.extractTar(file, dest);
      }

      case '.zip': {
        return tc.extractZip(file, dest);
      }

      default: {
        throw new Error(`unknown ext: ${ext}`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
      }
    }
  }

  // * NOTE: tar xz -C haxe-4.0.5-linux64 -f haxe-4.0.5-linux64.tar.gz --> haxe-4.0.5-linux64/haxe_20191217082701_67feacebc
  private async findToolRoot(extractPath: string, nested: boolean) {
    if (!nested) {
      return extractPath;
    }

    let found = false;
    let toolRoot = '';
    await exec('ls', ['-1', extractPath], {
      listeners: {
        stdout(data) {
          const entry = data.toString().trim();
          if (entry.length > 0) {
            toolRoot = path.join(extractPath, entry);
            found = true;
          }
        },
      },
    });
    return found ? toolRoot : null;
  }
}

// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-osx-universal.tar.gz
// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-win64.zip
export class NekoAsset extends Asset {
  static resolveFromHaxeVersion(version: string, nightly: boolean) {
    const env = new Env();

    if (nightly) {
      return new NekoAsset('latest', true, false, env);
    }

    // Haxe older than 4.3 has issues with mbedtls 3 in neko 2.4
    const nekoVer = version.startsWith('3.') || (version.startsWith('4.') && version < '4.3.') ? '2.3.0'
      : '2.4.0';
    // Haxe 3 on windows has 32 bit haxelib, which requires 32 bit neko
    const force32 = version.startsWith('3.') && env.platform === 'win';

    return new NekoAsset(nekoVer, false, force32, env);
  }

  nightly = false;

  constructor(version: string, nightly: boolean, protected readonly force32: boolean, env = new Env()) {
    super('neko', version, env);
    this.nightly = nightly;
  }

  get downloadUrl() {
    if (this.nightly) {
      return `https://build.haxe.org/builds/neko/${this.nightlyTarget}/neko_${this.version}${this.fileExt}`;
    }

    const tag = `v${this.version.replace(/\./g, '-')}`;
    return super.makeDownloadUrl(
      `/neko/releases/download/${tag}/${this.fileNameWithoutExt}${this.fileExt}`,
    );
  }

  get target() {
    if (this.force32) {
      return this.env.platform;
    }

    if (this.env.platform === 'osx' && this.version.startsWith('2.4')) {
      return 'osx-universal';
    }

    return `${this.env.platform}${this.env.arch}`;
  }

  get nightlyTarget() {
    const plat = this.env.platform;
    switch (plat) {
      case 'osx': {
        return 'mac-universal';
      }

      case 'linux': {
        return 'linux64';
      }

      case 'win': {
        return 'windows64';
      }

      default: {
        throw new Error(`${plat} not supported`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
      }
    }
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
// * NOTE https://build.haxe.org/builds/haxe/mac/haxe_latest.tar.gz
export class HaxeAsset extends Asset {
  nightly = false;

  constructor(version: string, nightly: boolean, env = new Env()) {
    super('haxe', version, env);
    this.nightly = nightly;
  }

  get downloadUrl() {
    if (this.nightly) {
      return `https://build.haxe.org/builds/haxe/${this.nightlyTarget}/${this.fileNameWithoutExt}${this.fileExt}`;
    }

    return super.makeDownloadUrl(
      `/haxe/releases/download/${this.version}/${this.fileNameWithoutExt}${this.fileExt}`,
    );
  }

  get target() {
    if (this.env.platform === 'osx') {
      return this.env.platform;
    }

    // No 64bit version of neko 2.1 available for windows, thus we can also only use 32bit version of Haxe 3
    if (this.env.platform === 'win' && this.version.startsWith('3.')) {
      return this.env.platform;
    }

    return `${this.env.platform}${this.env.arch}`;
  }

  get nightlyTarget() {
    const plat = this.env.platform;
    switch (plat) {
      case 'osx': {
        return 'mac';
      }

      case 'linux': {
        return 'linux64';
      }

      case 'win': {
        return 'windows64';
      }

      default: {
        throw new Error(`${plat} not supported`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
      }
    }
  }

  get fileNameWithoutExt() {
    if (this.nightly) {
      return `haxe_${this.version}`;
    }

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
      case 'linux': {
        return 'linux';
      }

      case 'win32': {
        return 'win';
      }

      case 'darwin': {
        return 'osx';
      }

      default: {
        throw new Error(`${plat} not supported`);
      }
    }
  }

  get arch() {
    const arch = os.arch();

    if (arch === 'x64') {
      return '64';
    }

    if (arch === 'arm64' && this.platform === 'osx') {
      return '64';
    }

    throw new Error(`${arch} not supported`);
  }
}
