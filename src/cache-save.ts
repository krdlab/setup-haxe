import * as core from '@actions/core';
import {saveHaxelib} from './haxelib';

export async function run() {
  try {
    const cacheDependencyPath = core.getInput('cache-dependency-path');
    if (cacheDependencyPath.length > 0) {
      await saveHaxelib();
    }
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-implicit-any-catch
    core.setFailed(error.message);
  }
}

await run();
