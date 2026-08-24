import type { ExecOptions } from '@actions/exec';
import { exec } from '@actions/exec';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadWithCurl } from './curl';

vi.mock('@actions/exec', () => ({
  exec: vi.fn(),
}));

vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const url = 'https://github.com/HaxeFoundation/haxe/releases/download/4.3.7/haxe-4.3.7-linux64.tar.gz';
const dest = '/runner/temp/6b2f6a1e-0f1a-4d0a-9a3f-2b7c5d8e9f01';

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

describe('downloadWithCurl', () => {
  it('invokes curl once with -fsSL, bounded retries and an explicit output path', async () => {
    mockCurl(0);
    await downloadWithCurl(url, dest);

    expect(exec).toHaveBeenCalledTimes(1);
    const [command, args] = curlCall();
    expect(command).toBe('curl');
    expect(args).toEqual(['-fsSL', '--retry', '3', '--retry-all-errors', '--retry-max-time', '90', '-o', dest, url]);
  });

  // #127: --retry on its own skips transport failures such as exit 56, so the widening flag
  // has to stay next to it.
  it('widens curl retries beyond its built-in transient set', async () => {
    mockCurl(0);
    await downloadWithCurl(url, dest);

    const [, args] = curlCall();
    expect(args).toContain('--retry-all-errors');
  });

  // #62: build.haxe.org serves relative redirects, so redirect following must survive any
  // argv change, whether the short flags stay bundled or get split apart.
  it('keeps following redirects', async () => {
    mockCurl(0);
    await downloadWithCurl(url, dest);

    const [, args] = curlCall();
    const followsRedirects = args.some((arg) => arg === '--location' || /^-[a-zA-Z]*L/.test(arg));
    expect(followsRedirects).toBe(true);
  });

  it('lets the caller inspect the exit code instead of throwing inside exec', async () => {
    mockCurl(0);
    await downloadWithCurl(url, dest);

    const [, , options] = curlCall();
    expect(options.ignoreReturnCode).toBe(true);
  });

  it('reports the url, the exit code and curl stderr on failure', async () => {
    mockCurl(56, 'curl: (56) Connection died, tried 5 times before giving up\n');

    await expect(downloadWithCurl(url, dest)).rejects.toThrow(
      `Failed to download asset from ${url} (curl exit code 56): curl: (56) Connection died, tried 5 times before giving up`,
    );
  });

  it('falls back to a placeholder message when curl fails silently', async () => {
    mockCurl(56);

    await expect(downloadWithCurl(url, dest)).rejects.toThrow(
      'curl exited with a non-zero status but produced no error output.',
    );
  });

  // Retries happen inside curl, so the action still spawns exactly one process and propagates
  // whatever that process finally exits with.
  it('spawns one curl process and surfaces its final exit code', async () => {
    mockCurl(56, 'curl: (56) Connection died\n');

    await expect(downloadWithCurl(url, dest)).rejects.toThrow(/curl exit code 56/);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed url before spawning curl', async () => {
    mockCurl(0);

    await expect(downloadWithCurl('not a url', dest)).rejects.toThrow();
    expect(exec).not.toHaveBeenCalled();
  });
});
