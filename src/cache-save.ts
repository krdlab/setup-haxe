import * as core from '@actions/core';
import {saveHaxelib} from './haxelib';

export async function run() {
  try {
    const cacheDependencyPath = core.getInput('cache-dependency-path');
    if (cacheDependencyPath.length > 0) {
      await saveHaxelib();
    }
  } catch (error: unknown) {
    core.setFailed(typeof error === 'string' ? error : String(error));
  }
}

await run();
