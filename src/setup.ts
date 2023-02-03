// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as path from 'path';
import * as core from '@actions/core';
import { exec } from '@actions/exec';
import { NekoAsset, HaxeAsset, Env } from './asset';

const env = new Env();

export async function setup(version: string, nightly: boolean) {
  const neko = NekoAsset.resolveFromHaxeVersion(version); // haxelib requires Neko
  const nekoPath = await neko.setup();
  core.addPath(nekoPath);
  core.exportVariable('NEKOPATH', nekoPath);
  core.exportVariable('LD_LIBRARY_PATH', `${nekoPath}:$LD_LIBRARY_PATH`);

  const haxe = new HaxeAsset(version, nightly);
  const haxePath = await haxe.setup();
  core.addPath(haxePath);
  core.exportVariable('HAXE_STD_PATH', path.join(haxePath, 'std'));

  if (env.platform === 'osx') {
    // ref: https://github.com/asdf-community/asdf-haxe/pull/7
    await exec('ln', [
      '-sfv',
      path.join(nekoPath, 'libneko.2.dylib'),
      path.join(haxePath, 'libneko.2.dylib'),
    ]);
  }
  await exec('haxelib', ['setup', path.join(haxePath, 'lib')]);
}
