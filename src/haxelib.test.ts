import * as glob from '@actions/glob';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHaxelibKey } from './haxelib';

vi.mock('@actions/glob', () => ({
  hashFiles: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('createHaxelibKey', () => {
  it('formats the key with platform / version / hash sections', async () => {
    vi.mocked(glob.hashFiles).mockResolvedValue('abc123');
    const key = await createHaxelibKey('linux64', '4.3.7', 'lib.hxml');
    expect(key).toBe('haxelib-cache-linux64-haxe4.3.7-abc123');
  });

  it('passes the platform argument through transparently', async () => {
    vi.mocked(glob.hashFiles).mockResolvedValue('xyz');
    const key = await createHaxelibKey('osx', '3.4.7', 'lib.hxml');
    expect(key).toBe('haxelib-cache-osx-haxe3.4.7-xyz');
  });

  it('throws when hashFiles returns empty', async () => {
    vi.mocked(glob.hashFiles).mockResolvedValue('');
    await expect(createHaxelibKey('linux64', '4.3.7', 'lib.hxml')).rejects.toThrow(/unable to cache dependencies/);
  });
});
