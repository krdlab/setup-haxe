import type * as OsType from 'node:os';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ExecOptions } from '@actions/exec';
import { exec } from '@actions/exec';
import * as tc from '@actions/tool-cache';
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

vi.mock('@actions/tool-cache', () => ({
  extractTar: vi.fn(),
  extractZip: vi.fn(),
  find: vi.fn(),
  cacheDir: vi.fn(),
}));

vi.mock('@actions/exec', () => ({
  exec: vi.fn(),
}));

vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

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
  ] as const)('%s/%s nightly fileNameWithoutExt = neko_latest (symmetric with HaxeAsset)', (platform, arch) => {
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

// Regression test for issue #40: extract must not write into the action's cwd
// ($GITHUB_WORKSPACE). It used to pass fileNameWithoutExt (a relative path) as
// the dest, leaving e.g. haxe_latest/.../std in the user's checkout.
describe('Asset.extract destination (issue #40)', () => {
  type ExtractFn = (file: string, ext: '.tar.gz' | '.zip') => Promise<string>;

  const originalRunnerTemp = process.env.RUNNER_TEMP;

  beforeEach(() => {
    process.env.RUNNER_TEMP = '/runner/temp';
  });

  afterEach(() => {
    if (originalRunnerTemp === undefined) {
      delete process.env.RUNNER_TEMP;
    } else {
      process.env.RUNNER_TEMP = originalRunnerTemp;
    }
  });

  it('.tar.gz is extracted under RUNNER_TEMP, not a cwd-relative path', async () => {
    const asset = new HaxeAsset('4.3.7', false);
    const file = '/tmp/download/haxe.tar.gz';
    await (asset as unknown as { extract: ExtractFn }).extract(file, '.tar.gz');

    expect(tc.extractTar).toHaveBeenCalledTimes(1);
    const [calledFile, dest] = vi.mocked(tc.extractTar).mock.calls[0] as [string, string];
    expect(calledFile).toBe(file);
    expect(path.isAbsolute(dest)).toBe(true);
    expect(dest.startsWith('/runner/temp')).toBe(true);
    expect(dest).not.toBe('haxe-4.3.7-linux64');
  });

  it('.zip is extracted under RUNNER_TEMP, not a cwd-relative path', async () => {
    const asset = new HaxeAsset('4.3.7', false);
    const file = '/tmp/download/haxe.zip';
    await (asset as unknown as { extract: ExtractFn }).extract(file, '.zip');

    expect(tc.extractZip).toHaveBeenCalledTimes(1);
    const [calledFile, dest] = vi.mocked(tc.extractZip).mock.calls[0] as [string, string];
    expect(calledFile).toBe(file);
    expect(path.isAbsolute(dest)).toBe(true);
    expect(dest.startsWith('/runner/temp')).toBe(true);
    expect(dest).not.toBe('haxe-4.3.7-linux64');
  });
});

// Characterization tests for the current downloadWithCurl contract (issue #127).
// These pin today's behaviour before bounded retries are introduced, so that any
// change to the argv, the error message or the number of curl invocations shows up
// as an intentional diff rather than a silent regression.
describe('Asset.downloadWithCurl (current contract)', () => {
  type DownloadFn = (url: string) => Promise<string>;

  const url = 'https://github.com/HaxeFoundation/haxe/releases/download/4.3.7/haxe-4.3.7-linux64.tar.gz';
  const originalRunnerTemp = process.env.RUNNER_TEMP;

  beforeEach(() => {
    process.env.RUNNER_TEMP = '/runner/temp';
  });

  afterEach(() => {
    if (originalRunnerTemp === undefined) {
      delete process.env.RUNNER_TEMP;
    } else {
      process.env.RUNNER_TEMP = originalRunnerTemp;
    }
  });

  function download(target = url): Promise<string> {
    const asset = new HaxeAsset('4.3.7', false);
    return (asset as unknown as { downloadWithCurl: DownloadFn }).downloadWithCurl(target);
  }

  function curlCall(index = 0) {
    return vi.mocked(exec).mock.calls[index] as [string, string[], ExecOptions];
  }

  function mockCurl(exitCode: number, stderr = ''): void {
    vi.mocked(exec).mockImplementation(async (_command, _args, options?: ExecOptions) => {
      if (stderr) {
        options?.listeners?.stderr?.(Buffer.from(stderr));
      }

      return exitCode;
    });
  }

  it('invokes curl once with -fsSL and an explicit output path', async () => {
    mockCurl(0);
    const dest = await download();

    expect(exec).toHaveBeenCalledTimes(1);
    const [command, args] = curlCall();
    expect(command).toBe('curl');
    expect(args).toEqual(['-fsSL', '-o', dest, url]);
  });

  it('lets the caller inspect the exit code instead of throwing inside exec', async () => {
    mockCurl(0);
    await download();

    const [, , options] = curlCall();
    expect(options.ignoreReturnCode).toBe(true);
  });

  it('downloads into RUNNER_TEMP, not the working directory', async () => {
    mockCurl(0);
    const dest = await download();

    expect(path.isAbsolute(dest)).toBe(true);
    expect(path.dirname(dest)).toBe('/runner/temp');
  });

  it('returns the destination path on success', async () => {
    mockCurl(0);
    const dest = await download();

    const [, args] = curlCall();
    expect(dest).toBe(args[2]);
  });

  it('reports the url, the exit code and curl stderr on failure', async () => {
    mockCurl(56, 'curl: (56) Connection died, tried 5 times before giving up\n');

    await expect(download()).rejects.toThrow(
      `Failed to download asset from ${url} (curl exit code 56): curl: (56) Connection died, tried 5 times before giving up`,
    );
  });

  it('falls back to a placeholder message when curl fails silently', async () => {
    mockCurl(56);

    await expect(download()).rejects.toThrow('curl exited with a non-zero status but produced no error output.');
  });

  it('does not retry a failed download', async () => {
    mockCurl(56, 'curl: (56) Connection died\n');

    await expect(download()).rejects.toThrow(/curl exit code 56/);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed url before spawning curl', async () => {
    mockCurl(0);

    await expect(download('not a url')).rejects.toThrow();
    expect(exec).not.toHaveBeenCalled();
  });
});
