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

import type { AgentWorkspaceContext, ExtensionContext } from '@openkaiden/api';
import { agents } from '@openkaiden/api';
import { z } from 'zod';

const CopilotSettingsSchema = z.looseObject({
  chat: z.looseObject({ model: z.string().optional() }).optional(),
});

const CopilotSettingsCodec = z.codec(z.string(), CopilotSettingsSchema, {
  decode: (jsonString, ctx) => {
    try {
      return JSON.parse(jsonString);
    } catch (err: unknown) {
      ctx.issues.push({
        code: 'invalid_format',
        format: 'json',
        input: jsonString,
        message: err instanceof Error ? err.message : 'Invalid JSON',
      });
      return z.NEVER;
    }
  },
  encode: value => JSON.stringify(value, undefined, 2),
});

export const COPILOT_SETTINGS_PATH = '.copilot/settings.json';

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const disposable = agents.registerAgent({
    id: 'copilot',
    name: 'GitHub Copilot',
    // blurb extracted from https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli
    description:
      'GitHub Copilot CLI gives you quick access to a powerful AI agent, without having to leave your terminal.',
    icon: {
      icon: {
        light: './icon_light.png',
        dark: './icon_dark.png',
      },
      logo: {
        dark: './icon_dark.png',
        light: './icon_light.png',
      },
    },
    command: 'copilot',
    acp: { args: ['--acp'] },
    tags: [],
    destinationSkillsFolder: '${HOME}/.copilot/skills',
    configurationFiles: [
      {
        path: COPILOT_SETTINGS_PATH,
        async read(): Promise<string> {
          return '{}';
        },
      },
    ],
    isSupportedModelType(type): boolean {
      return type.name !== 'vertexai';
    },
    async preWorkspaceStart(context: AgentWorkspaceContext): Promise<void> {
      const configFile = context.configurationFiles.find(f => f.path === COPILOT_SETTINGS_PATH);
      if (!configFile) {
        return;
      }

      const config = CopilotSettingsCodec.decode(await configFile.read());
      config.chat = { ...config.chat, model: context.model.model.label };

      await configFile.update(CopilotSettingsCodec.encode(config));
    },
  });
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {}
