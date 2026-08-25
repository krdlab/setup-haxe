// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Buffer } from 'node:buffer';
import * as core from '@actions/core';
import { exec } from '@actions/exec';

// NOTE: curl's default retry set covers timeouts and a few transient HTTP statuses, but not
// transport failures such as exit 56, so --retry alone would not have covered #127;
// --retry-all-errors is what widens it. (The exact default set varies by curl version, so it is
// deliberately not enumerated here.) Retrying is safe for this idempotent GET because curl
// discards a failed partial transfer before reusing the -o file.
// --retry-max-time bounds when a new attempt may start; it does not cap a running transfer.
// Combined with -f this also retries permanent failures such as a 404 from a mistyped
// haxe-version, which costs ~7s of backoff before failing. That is the accepted tradeoff.
// Requires curl 7.71.0+, satisfied by every GitHub-hosted runner image.
const CURL_RETRY_ARGS = ['--retry', '3', '--retry-all-errors', '--retry-max-time', '90'] as const;

// NOTE: the toolkit's http-client does not support relative redirects, which build.haxe.org
// relies on, so downloads go through curl instead of tc.downloadTool (#61).
// https://github.com/actions/toolkit/blob/d47594b53638f7035a96b5ec1ed1e6caae66ee8d/packages/http-client/src/index.ts#L399-L405
export async function downloadWithCurl(url: string, dest: string): Promise<void> {
  const validUrl = new URL(url);
  core.debug(`downloading ${validUrl.toString()} to ${dest}`);

  let stderr = '';
  const exitCode = await exec('curl', ['-fsSL', ...CURL_RETRY_ARGS, '-o', dest, validUrl.toString()], {
    ignoreReturnCode: true,
    listeners: {
      stderr(data: Buffer) {
        stderr += data.toString();
      },
    },
  });

  if (exitCode !== 0) {
    const message = stderr.trim() || 'curl exited with a non-zero status but produced no error output.';
    throw new Error(`Failed to download asset from ${url} (curl exit code ${exitCode}): ${message}`);
  }
}
