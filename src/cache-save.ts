import * as core from '@actions/core';
import { saveHaxelib } from './haxelib';

async function run() {
  try {
    const cacheDependencyPath = core.getInput('cache-dependency-path');
    if (cacheDependencyPath.length > 0) {
      await saveHaxelib();
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

await run();
