import * as fs from 'node:fs';
import * as core from '@actions/core';
import * as cache from '@actions/cache';
import * as glob from '@actions/glob';

enum State {
  CachePrimaryKey = 'PRIMARY_KEY',
  CacheRestoreResult = 'RESTORE_RESULT',
  CacheHaxelibPath = 'HAXELIB_PATH',
}

export async function createHaxelibKey(platform: string, version: string, cacheDependencyPath: string): Promise<string> {
  const fileHash = await glob.hashFiles(cacheDependencyPath);
  if (!fileHash) {
    throw new Error(
      'Some specified paths were not resolved, unable to cache dependencies.',
    );
  }

  return `haxelib-cache-${platform}-haxe${version}-${fileHash}`;
}

export async function restoreHaxelib(primaryKey: string, haxelibPath: string): Promise<void> {
  core.saveState(State.CachePrimaryKey, primaryKey);
  core.saveState(State.CacheHaxelibPath, haxelibPath);

  const restoreResult = await cache.restoreCache([haxelibPath], primaryKey);
  core.setOutput('cache-hit', Boolean(restoreResult));

  if (!restoreResult) {
    core.info('haxelib cache is not found');
    return;
  }

  core.saveState(State.CacheRestoreResult, restoreResult);
  core.info(`Cache restored from key: ${restoreResult}`);
}

export async function saveHaxelib(): Promise<void> {
  const restoreResult = core.getState(State.CacheRestoreResult);
  const primaryKey = core.getState(State.CachePrimaryKey);
  const haxelibPath = core.getState(State.CacheHaxelibPath);

  if (!fs.existsSync(haxelibPath)) {
    throw new Error(
      `Cache folder path is retrieved but doesn't exist on disk: ${haxelibPath}`,
    );
  }

  if (primaryKey === restoreResult) {
    core.info(
      `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`,
    );
    return;
  }

  const cacheId = await cache.saveCache([haxelibPath], primaryKey);
  if (cacheId === -1) {
    return;
  }

  core.info(`Cache saved with the key: ${primaryKey}`);
}
