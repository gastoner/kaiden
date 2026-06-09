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
 ***********************************************************************/

import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Disposable, FileSystemWatcher } from '@openkaiden/api';
import { inject, injectable, preDestroy } from 'inversify';

import { IPCHandle } from '/@/plugin/api.js';
import { FilesystemMonitoring } from '/@/plugin/filesystem-monitoring.js';
import { KdnCli } from '/@/plugin/kdn-cli/kdn-cli.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type {
  SecretCliBackend,
  SecretCreateOptions,
  SecretInfo,
  SecretName,
  SecretService,
} from '/@api/secret-info.js';

import { OpenshellSecretAdapter } from './openshell-secret-adapter.js';

/**
 * Manages secrets by delegating to a CLI backend.
 *
 * By default the `kdn` CLI is used. When the `KAIDEN_OPENSHELL`
 * environment variable is set, the OpenShell provider commands
 * are used instead (via {@link OpenshellSecretAdapter}).
 *
 * Watches `~/.kdn/secrets.json` so that external mutations
 * (e.g. `kdn secret remove` run from a terminal) are picked
 * up and forwarded to the renderer. File watching is skipped
 * when the OpenShell backend is active.
 */
@injectable()
export class SecretManager implements Disposable {
  private secretsWatcher: FileSystemWatcher | undefined;

  constructor(
    @inject(ApiSenderType)
    private readonly apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
    @inject(KdnCli)
    private readonly kdnCli: KdnCli,
    @inject(OpenshellSecretAdapter)
    private readonly openshellAdapter: OpenshellSecretAdapter,
    @inject(FilesystemMonitoring)
    private readonly filesystemMonitoring: FilesystemMonitoring,
  ) {}

  private get cli(): SecretCliBackend {
    if (process.env['KAIDEN_OPENSHELL']) {
      return this.openshellAdapter;
    }
    return this.kdnCli;
  }

  async create(options: SecretCreateOptions): Promise<SecretName> {
    const result = await this.cli.createSecret(options);
    this.apiSender.send('secret-manager-update');
    return result;
  }

  async list(): Promise<SecretInfo[]> {
    return this.cli.listSecrets();
  }

  async remove(name: string): Promise<SecretName> {
    const result = await this.cli.removeSecret(name);
    this.apiSender.send('secret-manager-update');
    return result;
  }

  async listServices(): Promise<SecretService[]> {
    return this.cli.listServices();
  }

  init(): void {
    this.ipcHandle(
      'secret-manager:create',
      async (_listener: unknown, options: SecretCreateOptions): Promise<SecretName> => {
        return this.create(options);
      },
    );

    this.ipcHandle('secret-manager:list', async (): Promise<SecretInfo[]> => {
      return this.list();
    });

    this.ipcHandle('secret-manager:remove', async (_listener: unknown, name: string): Promise<SecretName> => {
      return this.remove(name);
    });

    this.ipcHandle('secret-manager:list-services', async (): Promise<SecretService[]> => {
      return this.listServices();
    });

    if (!process.env['KAIDEN_OPENSHELL']) {
      this.watchSecretsFile();
    }
  }

  private watchSecretsFile(): void {
    this.secretsWatcher?.dispose();
    const secretsPath = join(homedir(), '.kdn', 'secrets.json');
    this.secretsWatcher = this.filesystemMonitoring.createFileSystemWatcher(secretsPath);
    const notify = (): void => {
      this.apiSender.send('secret-manager-update');
    };
    this.secretsWatcher.onDidChange(notify);
    this.secretsWatcher.onDidCreate(notify);
    this.secretsWatcher.onDidDelete(notify);
  }

  @preDestroy()
  dispose(): void {
    this.secretsWatcher?.dispose();
  }
}
