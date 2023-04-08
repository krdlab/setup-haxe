import * as process from 'node:process';
import * as core from '@actions/core';
import {saveHaxelib} from './haxelib';

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', error => {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${error.message}`);
});

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
