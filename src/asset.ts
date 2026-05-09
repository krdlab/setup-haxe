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
import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as tc from '@actions/tool-cache';

type AssetFileExt = '.zip' | '.tar.gz';

type Tool = 'haxe' | 'neko';

type Resolution =
  | { kind: 'stable'; cachePlatform: string; archiveTarget: string }
  | { kind: 'nightly'; cachePlatform: string; nightlyPathSegment: string }
  | { kind: 'unsupported'; reason: string };

type SupportedResolution = Extract<Resolution, { kind: 'stable' | 'nightly' }>;

interface ResolveInput {
  tool: Tool;
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  nightly: boolean;
  force32: boolean;
}

export function resolveTarget(input: ResolveInput): Resolution {
  const { tool, platform, arch } = input;

  if (platform === 'win32' && arch === 'arm64') {
    return {
      kind: 'unsupported',
      reason: 'Windows ARM64 is not supported (no upstream Haxe/Neko archives).',
    };
  }

  if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
    return { kind: 'unsupported', reason: `${platform} is not supported.` };
  }

  if (arch !== 'x64' && arch !== 'arm64') {
    return { kind: 'unsupported', reason: `${arch} is not supported.` };
  }

  return tool === 'haxe'
    ? resolveHaxe({ version: input.version, platform, arch, nightly: input.nightly })
    : resolveNeko({
        version: input.version,
        platform,
        arch,
        nightly: input.nightly,
        force32: input.force32,
      });
}

function resolveHaxe(input: {
  version: string;
  platform: 'darwin' | 'linux' | 'win32';
  arch: 'x64' | 'arm64';
  nightly: boolean;
}): Resolution {
  const { version, platform, arch, nightly } = input;

  if (nightly) {
    switch (platform) {
      case 'darwin': {
        return { kind: 'nightly', cachePlatform: 'osx', nightlyPathSegment: 'mac' };
      }

      case 'linux': {
        return arch === 'arm64'
          ? { kind: 'nightly', cachePlatform: 'linux-arm64', nightlyPathSegment: 'linux-arm64' }
          : { kind: 'nightly', cachePlatform: 'linux64', nightlyPathSegment: 'linux64' };
      }

      case 'win32': {
        return { kind: 'nightly', cachePlatform: 'win64', nightlyPathSegment: 'windows64' };
      }
    }
  }

  switch (platform) {
    case 'darwin': {
      return { kind: 'stable', cachePlatform: 'osx', archiveTarget: 'osx' };
    }

    case 'linux': {
      if (arch === 'arm64') {
        return {
          kind: 'unsupported',
          reason: "Stable Haxe does not publish Linux ARM64 archives upstream; use 'haxe-version: latest'.",
        };
      }

      return { kind: 'stable', cachePlatform: 'linux64', archiveTarget: 'linux64' };
    }

    case 'win32': {
      if (version.startsWith('3.')) {
        return { kind: 'stable', cachePlatform: 'win', archiveTarget: 'win' };
      }

      return { kind: 'stable', cachePlatform: 'win64', archiveTarget: 'win64' };
    }
  }
}

function resolveNeko(input: {
  version: string;
  platform: 'darwin' | 'linux' | 'win32';
  arch: 'x64' | 'arm64';
  nightly: boolean;
  force32: boolean;
}): Resolution {
  const { version, platform, arch, nightly, force32 } = input;

  if (nightly) {
    switch (platform) {
      case 'darwin': {
        return { kind: 'nightly', cachePlatform: 'osx', nightlyPathSegment: 'mac-universal' };
      }

      case 'linux': {
        return arch === 'arm64'
          ? { kind: 'nightly', cachePlatform: 'linux-arm64', nightlyPathSegment: 'linux-arm64' }
          : { kind: 'nightly', cachePlatform: 'linux64', nightlyPathSegment: 'linux64' };
      }

      case 'win32': {
        return { kind: 'nightly', cachePlatform: 'win64', nightlyPathSegment: 'windows64' };
      }
    }
  }

  switch (platform) {
    case 'darwin': {
      return version.startsWith('2.4')
        ? { kind: 'stable', cachePlatform: 'osx', archiveTarget: 'osx-universal' }
        : { kind: 'stable', cachePlatform: 'osx', archiveTarget: 'osx64' };
    }

    case 'linux': {
      if (arch === 'arm64') {
        if (version.startsWith('2.3')) {
          return {
            kind: 'unsupported',
            reason: "Neko 2.3.x has no Linux ARM64 binary; requires Neko 2.4+ (use Haxe 4.3+ or 'latest').",
          };
        }

        return { kind: 'stable', cachePlatform: 'linux-arm64', archiveTarget: 'linux-arm64' };
      }

      return { kind: 'stable', cachePlatform: 'linux64', archiveTarget: 'linux64' };
    }

    case 'win32': {
      if (force32) {
        return { kind: 'stable', cachePlatform: 'win', archiveTarget: 'win' };
      }

      return { kind: 'stable', cachePlatform: 'win64', archiveTarget: 'win64' };
    }
  }
}

abstract class Asset {
  constructor(
    readonly name: string,
    readonly version: string,
  ) {}

  async setup() {
    const toolPath = tc.find(this.name, this.version);
    if (toolPath) {
      return toolPath;
    }

    return tc.cacheDir(await this.download(), this.name, this.version);
  }

  abstract get cachePlatform(): string;

  protected abstract get downloadUrl(): string;
  protected abstract get fileNameWithoutExt(): string;
  protected abstract get isDirectoryNested(): boolean;

  protected makeDownloadUrl(path: string) {
    return `https://github.com/HaxeFoundation${path}`;
  }

  protected get fileExt(): AssetFileExt {
    return os.platform() === 'win32' ? '.zip' : '.tar.gz';
  }

  protected resolve(tool: Tool, force32 = false): Resolution {
    return resolveTarget({
      tool,
      version: this.version,
      platform: os.platform(),
      arch: os.arch(),
      nightly: this.isNightly,
      force32,
    });
  }

  protected get isNightly(): boolean {
    return false;
  }

  protected requireSupported(resolution: Resolution): SupportedResolution {
    if (resolution.kind === 'unsupported') {
      throw new Error(resolution.reason);
    }

    return resolution;
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
        throw new Error(`unknown ext: ${ext}`);
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
    if (nightly) {
      return new NekoAsset('latest', true, false);
    }

    // Haxe older than 4.3 has issues with mbedtls 3 in neko 2.4
    const nekoVer = version.startsWith('3.') || (version.startsWith('4.') && version < '4.3.') ? '2.3.0' : '2.4.0';
    // Haxe 3 on windows has 32 bit haxelib, which requires 32 bit neko
    const force32 = version.startsWith('3.') && os.platform() === 'win32';

    return new NekoAsset(nekoVer, false, force32);
  }

  constructor(
    version: string,
    protected readonly nightly: boolean,
    protected readonly force32: boolean,
  ) {
    super('neko', version);
  }

  get cachePlatform() {
    return this.requireSupported(this.resolve('neko', this.force32)).cachePlatform;
  }

  get downloadUrl() {
    const resolution = this.requireSupported(this.resolve('neko', this.force32));
    if (resolution.kind === 'nightly') {
      return `https://build.haxe.org/builds/neko/${resolution.nightlyPathSegment}/${this.fileNameWithoutExt}${this.fileExt}`;
    }

    const tag = `v${this.version.replace(/\./g, '-')}`;
    return super.makeDownloadUrl(`/neko/releases/download/${tag}/${this.fileNameWithoutExt}${this.fileExt}`);
  }

  get fileNameWithoutExt() {
    const resolution = this.requireSupported(this.resolve('neko', this.force32));
    if (resolution.kind === 'nightly') {
      return `neko_${this.version}`;
    }

    return `neko-${this.version}-${resolution.archiveTarget}`;
  }

  get isDirectoryNested() {
    return true;
  }

  protected override get isNightly() {
    return this.nightly;
  }
}

// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/4.0.5/haxe-4.0.5-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/3.4.7/haxe-3.4.7-win64.zip
// * NOTE https://build.haxe.org/builds/haxe/mac/haxe_latest.tar.gz
export class HaxeAsset extends Asset {
  constructor(
    version: string,
    protected readonly nightly: boolean,
  ) {
    super('haxe', version);
  }

  get cachePlatform() {
    return this.requireSupported(this.resolve('haxe')).cachePlatform;
  }

  get downloadUrl() {
    const resolution = this.requireSupported(this.resolve('haxe'));
    if (resolution.kind === 'nightly') {
      return `https://build.haxe.org/builds/haxe/${resolution.nightlyPathSegment}/${this.fileNameWithoutExt}${this.fileExt}`;
    }

    return super.makeDownloadUrl(`/haxe/releases/download/${this.version}/${this.fileNameWithoutExt}${this.fileExt}`);
  }

  get fileNameWithoutExt() {
    const resolution = this.requireSupported(this.resolve('haxe'));
    if (resolution.kind === 'nightly') {
      return `haxe_${this.version}`;
    }

    return `haxe-${this.version}-${resolution.archiveTarget}`;
  }

  get isDirectoryNested() {
    return true;
  }

  protected override get isNightly() {
    return this.nightly;
  }
}
