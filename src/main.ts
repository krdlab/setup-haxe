// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as core from '@actions/core';
import * as semver from 'semver';
import { setup } from './setup';

async function main(): Promise<void> {
  try {
    const inputVersion = core.getInput('haxe-version');
    const cacheDependencyPath = core.getInput('cache-dependency-path');
    const nightly = /^(\d{4}-\d{2}-\d{2}_[\w.-]+_\w+)|latest$/.test(inputVersion);
    const version = nightly ? inputVersion : semver.valid(semver.clean(inputVersion));
    if (version) {
      await setup(version, nightly, cacheDependencyPath);
    }
  } catch (error: unknown) {
    core.setFailed(typeof error === 'string' ? error : String(error));
  }
}

await main();
