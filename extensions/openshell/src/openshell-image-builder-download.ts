/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/

import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ReleaseInfo } from './openshell-download';
import { download, verifyChecksum } from './openshell-download';

const IMAGE_BUILDER_REPO = 'openkaiden/openshell-image-builder';

const ASSET_MAP: Record<string, { assetName: string; binaryName: string }> = {
  'darwin-arm64': {
    assetName: 'openshell-image-builder-aarch64-apple-darwin',
    binaryName: 'openshell-image-builder',
  },
  'linux-x64': {
    assetName: 'openshell-image-builder-x86_64-unknown-linux-gnu',
    binaryName: 'openshell-image-builder',
  },
  'linux-arm64': {
    assetName: 'openshell-image-builder-aarch64-unknown-linux-gnu',
    binaryName: 'openshell-image-builder',
  },
  'win32-x64': {
    assetName: 'openshell-image-builder-x86_64-pc-windows-msvc.exe',
    binaryName: 'openshell-image-builder.exe',
  },
};

export async function getImageBuilderRelease(version: string): Promise<ReleaseInfo> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  const token = process.env['GITHUB_TOKEN'];
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`https://api.github.com/repos/${IMAGE_BUILDER_REPO}/releases/tags/v${version}`, {
    headers,
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`failed to fetch openshell-image-builder release v${version}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { tag_name: string; assets: { name: string; digest: string | null }[] };
  const resolvedVersion = data.tag_name.replace(/^v/, '');
  const digests = new Map<string, string>();
  for (const asset of data.assets) {
    if (asset.digest) {
      digests.set(asset.name, asset.digest.replace(/^sha256:/, ''));
    }
  }
  return { version: resolvedVersion, digests };
}

export async function downloadImageBuilderBinary(
  version: string,
  platform: string,
  arch: string,
  outputDir: string,
  digests: Map<string, string>,
): Promise<void> {
  const key = `${platform}-${arch}`;
  const asset = ASSET_MAP[key];
  if (!asset) {
    throw new Error(`unsupported target: ${key}. Supported: ${Object.keys(ASSET_MAP).join(', ')}`);
  }

  const versionFile = join(outputDir, '.openshell-image-builder-version');
  const versionMarker = `${version}-${platform}-${arch}`;
  const binaryPath = join(outputDir, asset.binaryName);

  if (existsSync(versionFile) && existsSync(binaryPath)) {
    const existing = await readFile(versionFile, { encoding: 'utf-8' });
    if (existing.trim() === versionMarker) {
      console.log(`openshell-image-builder ${version} for ${platform}/${arch} already downloaded`);
      return;
    }
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const url = `https://github.com/${IMAGE_BUILDER_REPO}/releases/download/v${version}/${asset.assetName}`;
  const downloadPath = join(outputDir, asset.assetName);

  console.log(`downloading openshell-image-builder ${version} for ${platform}/${arch}...`);
  await download(url, downloadPath);
  await verifyChecksum(digests, asset.assetName, downloadPath);

  if (downloadPath !== binaryPath) {
    await rename(downloadPath, binaryPath);
  }

  if (platform !== 'win32') {
    await chmod(binaryPath, 0o755);
  }

  await writeFile(versionFile, versionMarker, { encoding: 'utf-8' });
  console.log(`openshell-image-builder ${version} for ${platform}/${arch} ready`);
}
