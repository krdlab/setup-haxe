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
    const version = semver.valid(semver.clean(inputVersion));
    if (version) {
      await setup(version);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
