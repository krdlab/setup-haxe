import type * as OsType from 'node:os';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Env, HaxeAsset, NekoAsset } from './asset';

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof OsType>('node:os');
  return {
    ...actual,
    platform: vi.fn(() => 'linux'),
    arch: vi.fn(() => 'x64'),
  };
});

function setOs(platform: string, arch: string): void {
  vi.mocked(os.platform).mockReturnValue(platform as NodeJS.Platform);
  vi.mocked(os.arch).mockReturnValue(arch);
}

function makeEnv(platform: 'linux' | 'osx' | 'win', arch: '64' | 'arm64'): Env {
  const env = Object.create(Env.prototype) as Env;
  Object.defineProperty(env, 'platform', { get: () => platform, configurable: true });
  Object.defineProperty(env, 'arch', { get: () => arch, configurable: true });
  return env;
}

class TestableHaxe extends HaxeAsset {
  public override get downloadUrl(): string {
    return super.downloadUrl;
  }

  public override get fileNameWithoutExt(): string {
    return super.fileNameWithoutExt;
  }
}

class TestableNeko extends NekoAsset {
  public override get downloadUrl(): string {
    return super.downloadUrl;
  }

  public override get fileNameWithoutExt(): string {
    return super.fileNameWithoutExt;
  }
}

beforeEach(() => {
  setOs('linux', 'x64');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Env', () => {
  it.each([
    ['linux', 'x64', 'linux', '64'],
    ['linux', 'arm64', 'linux', 'arm64'],
    ['darwin', 'x64', 'osx', '64'],
    ['darwin', 'arm64', 'osx', '64'],
    ['win32', 'x64', 'win', '64'],
    ['win32', 'arm64', 'win', 'arm64'],
  ])('%s/%s -> platform=%s, arch=%s', (osPlatform, osArch, platform, arch) => {
    setOs(osPlatform, osArch);
    const env = new Env();
    expect(env.platform).toBe(platform);
    expect(env.arch).toBe(arch);
  });

  it('throws on unsupported platform', () => {
    setOs('aix', 'x64');
    const env = new Env();
    expect(() => env.platform).toThrow(/aix not supported/);
  });

  it('throws on unsupported arch (ia32)', () => {
    setOs('linux', 'ia32');
    const env = new Env();
    expect(() => env.arch).toThrow(/ia32 not supported/);
  });
});

describe('HaxeAsset (stable)', () => {
  it.each([
    ['linux', '64', '4.3.7', 'haxe-4.3.7-linux64.tar.gz', 'haxe-4.3.7-linux64'],
    ['osx', '64', '4.3.7', 'haxe-4.3.7-osx.tar.gz', 'haxe-4.3.7-osx'],
    ['osx', 'arm64', '4.3.7', 'haxe-4.3.7-osx.tar.gz', 'haxe-4.3.7-osx'],
    ['win', '64', '4.3.7', 'haxe-4.3.7-win64.zip', 'haxe-4.3.7-win64'],
    ['win', '64', '3.4.7', 'haxe-3.4.7-win.zip', 'haxe-3.4.7-win'],
  ] as const)('%s/%s + %s', (platform, arch, version, fileName, basename) => {
    const env = makeEnv(platform, arch);
    const asset = new TestableHaxe(version, false, env);
    expect(asset.downloadUrl).toBe(`https://github.com/HaxeFoundation/haxe/releases/download/${version}/${fileName}`);
    expect(asset.fileNameWithoutExt).toBe(basename);
  });

  it('Linux ARM64 + 4.3.7 currently falls through to linuxarm64 (unsupported upstream; pinned)', () => {
    const env = makeEnv('linux', 'arm64');
    const asset = new TestableHaxe('4.3.7', false, env);
    expect(asset.downloadUrl).toBe(
      'https://github.com/HaxeFoundation/haxe/releases/download/4.3.7/haxe-4.3.7-linuxarm64.tar.gz',
    );
    expect(asset.fileNameWithoutExt).toBe('haxe-4.3.7-linuxarm64');
  });
});

describe('HaxeAsset (nightly)', () => {
  it.each([
    ['linux', '64', 'linux64'],
    ['linux', 'arm64', 'linux-arm64'],
    ['osx', '64', 'mac'],
    ['osx', 'arm64', 'mac'],
    ['win', '64', 'windows64'],
  ] as const)('%s/%s -> build.haxe.org/builds/haxe/%s', (platform, arch, segment) => {
    const env = makeEnv(platform, arch);
    const asset = new TestableHaxe('latest', true, env);
    const ext = platform === 'win' ? 'zip' : 'tar.gz';
    expect(asset.downloadUrl).toBe(`https://build.haxe.org/builds/haxe/${segment}/haxe_latest.${ext}`);
    expect(asset.fileNameWithoutExt).toBe('haxe_latest');
  });
});

describe('NekoAsset (stable)', () => {
  it.each([
    ['linux', '64', '2.4.0', false, 'neko-2.4.0-linux64.tar.gz', 'v2-4-0'],
    ['linux', '64', '2.3.0', false, 'neko-2.3.0-linux64.tar.gz', 'v2-3-0'],
    ['linux', 'arm64', '2.4.0', false, 'neko-2.4.0-linux-arm64.tar.gz', 'v2-4-0'],
    ['osx', '64', '2.4.0', false, 'neko-2.4.0-osx-universal.tar.gz', 'v2-4-0'],
    ['osx', 'arm64', '2.4.0', false, 'neko-2.4.0-osx-universal.tar.gz', 'v2-4-0'],
    ['osx', '64', '2.3.0', false, 'neko-2.3.0-osx64.tar.gz', 'v2-3-0'],
    ['win', '64', '2.4.0', false, 'neko-2.4.0-win64.zip', 'v2-4-0'],
    ['win', '64', '2.3.0', true, 'neko-2.3.0-win.zip', 'v2-3-0'],
  ] as const)('%s/%s + Neko %s (force32=%s)', (platform, arch, version, force32, fileName, tag) => {
    const env = makeEnv(platform, arch);
    const asset = new TestableNeko(version, false, force32, env);
    expect(asset.downloadUrl).toBe(`https://github.com/HaxeFoundation/neko/releases/download/${tag}/${fileName}`);
    expect(asset.fileNameWithoutExt).toBe(fileName.replace(/\.(?:tar\.gz|zip)$/, ''));
  });
});

describe('NekoAsset (nightly; Linux ARM64 currently downloads linux64 — pinned bug)', () => {
  it.each([
    ['linux', '64', 'linux64'],
    ['linux', 'arm64', 'linux64'],
    ['osx', '64', 'mac-universal'],
    ['osx', 'arm64', 'mac-universal'],
    ['win', '64', 'windows64'],
  ] as const)('%s/%s -> build.haxe.org/builds/neko/%s', (platform, arch, segment) => {
    const env = makeEnv(platform, arch);
    const asset = new TestableNeko('latest', true, false, env);
    const ext = platform === 'win' ? 'zip' : 'tar.gz';
    expect(asset.downloadUrl).toBe(`https://build.haxe.org/builds/neko/${segment}/neko_latest.${ext}`);
  });

  it.each([
    ['linux', '64', 'neko-latest-linux64'],
    ['linux', 'arm64', 'neko-latest-linux-arm64'],
    ['osx', '64', 'neko-latest-osx64'],
    ['win', '64', 'neko-latest-win64'],
  ] as const)('%s/%s -> extract dir name = %s (current behavior; pinned for refactor)', (platform, arch, basename) => {
    const env = makeEnv(platform, arch);
    const asset = new TestableNeko('latest', true, false, env);
    expect(asset.fileNameWithoutExt).toBe(basename);
  });
});

describe('NekoAsset.resolveFromHaxeVersion', () => {
  it.each([
    ['3.4.7', false, '2.3.0', false],
    ['4.0.5', false, '2.3.0', false],
    ['4.2.5', false, '2.3.0', false],
    ['4.3.0', false, '2.4.0', false],
    ['4.3.7', false, '2.4.0', false],
    ['5.0.0-preview.1', false, '2.4.0', false],
    ['latest', true, 'latest', false],
    ['2026-03-19_master_5f449dc', true, 'latest', false],
  ] as const)('Haxe %s (nightly=%s) -> Neko %s, force32=%s', (haxeVer, nightly, expectedNeko, expectedForce32) => {
    const neko = NekoAsset.resolveFromHaxeVersion(haxeVer, nightly);
    expect(neko.version).toBe(expectedNeko);
    expect((neko as unknown as { force32: boolean }).force32).toBe(expectedForce32);
  });

  it('Haxe 3.4.7 on Windows -> force32=true', () => {
    setOs('win32', 'x64');
    const neko = NekoAsset.resolveFromHaxeVersion('3.4.7', false);
    expect(neko.version).toBe('2.3.0');
    expect((neko as unknown as { force32: boolean }).force32).toBe(true);
  });

  it('Haxe latest on Windows -> nightly branch ignores force32', () => {
    setOs('win32', 'x64');
    const neko = NekoAsset.resolveFromHaxeVersion('latest', true);
    expect(neko.version).toBe('latest');
    expect((neko as unknown as { force32: boolean }).force32).toBe(false);
  });

  it.each([
    ['3.4.7', '2.3.0'],
    ['4.2.5', '2.3.0'],
    ['4.3.0', '2.4.0'],
  ] as const)('Linux ARM64 + Haxe %s -> Neko %s (currently downloads even when 2.3.x has no arm64 asset; pinned for refactor)', (haxeVer, expectedNeko) => {
    setOs('linux', 'arm64');
    const neko = NekoAsset.resolveFromHaxeVersion(haxeVer, false);
    expect(neko.version).toBe(expectedNeko);
    expect((neko as unknown as { force32: boolean }).force32).toBe(false);
    const asset = new TestableNeko(neko.version, false, false, makeEnv('linux', 'arm64'));
    expect(asset.fileNameWithoutExt).toBe(`neko-${expectedNeko}-linux-arm64`);
  });
});
