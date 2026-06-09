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

import { inject, injectable } from 'inversify';

import { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type {
  SecretCliBackend,
  SecretCreateOptions,
  SecretInfo,
  SecretName,
  SecretService,
} from '/@api/secret-info.js';

/**
 * Adapts {@link OpenshellCli} provider commands to the
 * {@link SecretCliBackend} interface used by {@link SecretManager}.
 *
 * OpenShell manages credentials as "providers" rather than "secrets".
 * This adapter maps:
 *   - `createSecret`  → `openshell provider create`
 *   - `listSecrets`   → `openshell provider list`
 *   - `removeSecret`  → `openshell provider delete`
 *   - `listServices`  → returns `[]` (not supported by OpenShell)
 */
@injectable()
export class OpenshellSecretAdapter implements SecretCliBackend {
  constructor(
    @inject(OpenshellCli)
    private readonly openshellCli: OpenshellCli,
  ) {}

  async createSecret(options: SecretCreateOptions): Promise<SecretName> {
    await this.openshellCli.createProvider({
      name: options.name,
      type: options.type,
      credentials: { value: options.value },
    });
    return { name: options.name };
  }

  async listSecrets(): Promise<SecretInfo[]> {
    const providers = await this.openshellCli.listProviders();
    return providers.map(p => ({ name: p.name, type: p.type }));
  }

  async removeSecret(name: string): Promise<SecretName> {
    await this.openshellCli.deleteProvider(name);
    return { name };
  }

  async listServices(): Promise<SecretService[]> {
    return [];
  }
}
