import type * as OsType from 'node:os';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HaxeAsset, NekoAsset, resolveTarget } from './asset';

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

describe('HaxeAsset (stable)', () => {
  it.each([
    ['linux', 'x64', '4.3.7', 'haxe-4.3.7-linux64.tar.gz', 'haxe-4.3.7-linux64'],
    ['darwin', 'x64', '4.3.7', 'haxe-4.3.7-osx.tar.gz', 'haxe-4.3.7-osx'],
    ['darwin', 'arm64', '4.3.7', 'haxe-4.3.7-osx.tar.gz', 'haxe-4.3.7-osx'],
    ['win32', 'x64', '4.3.7', 'haxe-4.3.7-win64.zip', 'haxe-4.3.7-win64'],
    ['win32', 'x64', '3.4.7', 'haxe-3.4.7-win.zip', 'haxe-3.4.7-win'],
  ] as const)('%s/%s + %s', (platform, arch, version, fileName, basename) => {
    setOs(platform, arch);
    const asset = new TestableHaxe(version, false);
    expect(asset.downloadUrl).toBe(`https://github.com/HaxeFoundation/haxe/releases/download/${version}/${fileName}`);
    expect(asset.fileNameWithoutExt).toBe(basename);
  });

  it('Linux ARM64 + 4.3.7 throws an explicit unsupported error', () => {
    setOs('linux', 'arm64');
    const asset = new TestableHaxe('4.3.7', false);
    expect(() => asset.downloadUrl).toThrow(/Stable Haxe does not publish Linux ARM64/);
  });

  it('Windows ARM64 + 4.3.7 throws an explicit unsupported error', () => {
    setOs('win32', 'arm64');
    const asset = new TestableHaxe('4.3.7', false);
    expect(() => asset.downloadUrl).toThrow(/Windows ARM64 is not supported/);
  });
});

describe('HaxeAsset (nightly)', () => {
  it.each([
    ['linux', 'x64', 'linux64'],
    ['linux', 'arm64', 'linux-arm64'],
    ['darwin', 'x64', 'mac'],
    ['darwin', 'arm64', 'mac'],
    ['win32', 'x64', 'windows64'],
  ] as const)('%s/%s -> build.haxe.org/builds/haxe/%s', (platform, arch, segment) => {
    setOs(platform, arch);
    const asset = new TestableHaxe('latest', true);
    const ext = platform === 'win32' ? 'zip' : 'tar.gz';
    expect(asset.downloadUrl).toBe(`https://build.haxe.org/builds/haxe/${segment}/haxe_latest.${ext}`);
    expect(asset.fileNameWithoutExt).toBe('haxe_latest');
  });

  it('Windows ARM64 nightly throws an explicit unsupported error', () => {
    setOs('win32', 'arm64');
    const asset = new TestableHaxe('latest', true);
    expect(() => asset.downloadUrl).toThrow(/Windows ARM64 is not supported/);
  });
});

describe('NekoAsset (stable)', () => {
  it.each([
    ['linux', 'x64', '2.4.0', false, 'neko-2.4.0-linux64.tar.gz', 'v2-4-0'],
    ['linux', 'x64', '2.3.0', false, 'neko-2.3.0-linux64.tar.gz', 'v2-3-0'],
    ['linux', 'arm64', '2.4.0', false, 'neko-2.4.0-linux-arm64.tar.gz', 'v2-4-0'],
    ['darwin', 'x64', '2.4.0', false, 'neko-2.4.0-osx-universal.tar.gz', 'v2-4-0'],
    ['darwin', 'arm64', '2.4.0', false, 'neko-2.4.0-osx-universal.tar.gz', 'v2-4-0'],
    ['darwin', 'x64', '2.3.0', false, 'neko-2.3.0-osx64.tar.gz', 'v2-3-0'],
    ['win32', 'x64', '2.4.0', false, 'neko-2.4.0-win64.zip', 'v2-4-0'],
    ['win32', 'x64', '2.3.0', true, 'neko-2.3.0-win.zip', 'v2-3-0'],
  ] as const)('%s/%s + Neko %s (force32=%s)', (platform, arch, version, force32, fileName, tag) => {
    setOs(platform, arch);
    const asset = new TestableNeko(version, false, force32);
    expect(asset.downloadUrl).toBe(`https://github.com/HaxeFoundation/neko/releases/download/${tag}/${fileName}`);
    expect(asset.fileNameWithoutExt).toBe(fileName.replace(/\.(?:tar\.gz|zip)$/, ''));
  });

  it('Linux ARM64 + Neko 2.3.0 throws an explicit unsupported error', () => {
    setOs('linux', 'arm64');
    const asset = new TestableNeko('2.3.0', false, false);
    expect(() => asset.downloadUrl).toThrow(/Neko 2\.3\.x has no Linux ARM64 binary/);
  });

  it('Windows ARM64 + Neko 2.4.0 throws an explicit unsupported error', () => {
    setOs('win32', 'arm64');
    const asset = new TestableNeko('2.4.0', false, false);
    expect(() => asset.downloadUrl).toThrow(/Windows ARM64 is not supported/);
  });
});

describe('NekoAsset (nightly)', () => {
  it.each([
    ['linux', 'x64', 'linux64'],
    ['linux', 'arm64', 'linux-arm64'],
    ['darwin', 'x64', 'mac-universal'],
    ['darwin', 'arm64', 'mac-universal'],
    ['win32', 'x64', 'windows64'],
  ] as const)('%s/%s -> build.haxe.org/builds/neko/%s', (platform, arch, segment) => {
    setOs(platform, arch);
    const asset = new TestableNeko('latest', true, false);
    const ext = platform === 'win32' ? 'zip' : 'tar.gz';
    expect(asset.downloadUrl).toBe(`https://build.haxe.org/builds/neko/${segment}/neko_latest.${ext}`);
  });

  it.each([
    ['linux', 'x64'],
    ['linux', 'arm64'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
    ['win32', 'x64'],
  ] as const)('%s/%s extract dir name = neko_latest (symmetric with HaxeAsset)', (platform, arch) => {
    setOs(platform, arch);
    const asset = new TestableNeko('latest', true, false);
    expect(asset.fileNameWithoutExt).toBe('neko_latest');
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
    ['3.4.7'],
    ['4.2.5'],
  ] as const)('Linux ARM64 + Haxe %s (Neko 2.3.0) -> downloadUrl throws unsupported', (haxeVer) => {
    setOs('linux', 'arm64');
    const neko = NekoAsset.resolveFromHaxeVersion(haxeVer, false);
    expect(neko.version).toBe('2.3.0');
    expect(() => (neko as unknown as { downloadUrl: string }).downloadUrl).toThrow(/Neko 2\.3\.x has no Linux ARM64/);
  });

  it('Linux ARM64 + Haxe 4.3.0 (Neko 2.4.0) -> linux-arm64 archive', () => {
    setOs('linux', 'arm64');
    const neko = NekoAsset.resolveFromHaxeVersion('4.3.0', false);
    expect(neko.version).toBe('2.4.0');
    expect((neko as unknown as { fileNameWithoutExt: string }).fileNameWithoutExt).toBe('neko-2.4.0-linux-arm64');
  });
});

describe('resolveTarget cachePlatform (haxelib cache key compatibility)', () => {
  it.each([
    ['haxe', '4.3.7', 'linux', 'x64', false, 'linux64'],
    ['haxe', '4.3.7', 'darwin', 'x64', false, 'osx'],
    ['haxe', '4.3.7', 'darwin', 'arm64', false, 'osx'],
    ['haxe', '4.3.7', 'win32', 'x64', false, 'win64'],
    ['haxe', '3.4.7', 'win32', 'x64', false, 'win'],
    ['haxe', 'latest', 'linux', 'x64', true, 'linux64'],
    ['haxe', 'latest', 'darwin', 'arm64', true, 'osx'],
    ['haxe', 'latest', 'linux', 'arm64', true, 'linux-arm64'],
    ['neko', '2.4.0', 'linux', 'x64', false, 'linux64'],
    ['neko', '2.4.0', 'darwin', 'arm64', false, 'osx'],
    ['neko', '2.4.0', 'linux', 'arm64', false, 'linux-arm64'],
  ] as const)('%s %s on %s/%s (nightly=%s) -> cachePlatform=%s', (tool, version, platform, arch, nightly, expectedCachePlatform) => {
    const result = resolveTarget({
      tool,
      version,
      platform: platform as NodeJS.Platform,
      arch,
      nightly,
      force32: false,
    });
    expect(result.kind).not.toBe('unsupported');
    if (result.kind !== 'unsupported') {
      expect(result.cachePlatform).toBe(expectedCachePlatform);
    }
  });

  it('Neko 2.3.0 on Windows with force32 -> cachePlatform=win', () => {
    const result = resolveTarget({
      tool: 'neko',
      version: '2.3.0',
      platform: 'win32',
      arch: 'x64',
      nightly: false,
      force32: true,
    });
    expect(result.kind).toBe('stable');
    if (result.kind === 'stable') {
      expect(result.cachePlatform).toBe('win');
    }
  });
});
