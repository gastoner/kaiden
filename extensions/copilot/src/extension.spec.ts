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

import type {
  Agent,
  AgentConfigurationFile,
  AgentWorkspaceContext,
  Disposable,
  ExtensionContext,
} from '@openkaiden/api';
import { agents } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { activate, COPILOT_SETTINGS_PATH } from './extension';

const AGENT_DISPOSABLE_MOCK: Disposable = { dispose: vi.fn() };

let extensionContextMock: ExtensionContext;

beforeEach(() => {
  vi.resetAllMocks();

  extensionContextMock = {
    subscriptions: [],
  } as unknown as ExtensionContext;

  vi.mocked(agents.registerAgent).mockReturnValue(AGENT_DISPOSABLE_MOCK);
});

function getRegisteredAgent(): Agent {
  return vi.mocked(agents.registerAgent).mock.calls[0]![0];
}

function createContext(configFiles: AgentConfigurationFile[], modelLabel = 'gpt-4o'): AgentWorkspaceContext {
  return {
    model: {
      model: { label: modelLabel },
    },
    configurationFiles: configFiles,
    workspace: {},
  };
}

function createConfigFile(content = '{}'): AgentConfigurationFile & { updateMock: ReturnType<typeof vi.fn> } {
  const updateMock = vi.fn();
  const file: AgentConfigurationFile = {
    path: COPILOT_SETTINGS_PATH,
    read: vi.fn().mockResolvedValue(content),
    update: updateMock,
  };
  return Object.assign(file, { updateMock });
}

describe('activate', () => {
  test('registers copilot agent', async () => {
    await activate(extensionContextMock);

    expect(agents.registerAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'copilot',
        name: 'GitHub Copilot',
        description: expect.any(String),
        icon: expect.objectContaining({ icon: { light: './icon_light.png', dark: './icon_dark.png' } }),
        destinationSkillsFolder: '${HOME}/.copilot/skills',
        isSupportedModelType: expect.any(Function),
      }),
    );
  });

  test('pushes agent disposable to subscriptions', async () => {
    await activate(extensionContextMock);

    expect(extensionContextMock.subscriptions).toContain(AGENT_DISPOSABLE_MOCK);
  });

  test('registered agent supports all model types except vertexai', async () => {
    await activate(extensionContextMock);

    const agent = getRegisteredAgent();
    expect(agent.isSupportedModelType!({ name: 'openai' })).toBe(true);
    expect(agent.isSupportedModelType!({ name: 'gemini' })).toBe(true);
    expect(agent.isSupportedModelType!({ name: 'vertexai' })).toBe(false);
  });

  test('registers agent with settings.json configuration file', async () => {
    await activate(extensionContextMock);

    const agent = getRegisteredAgent();
    expect(agent.configurationFiles).toHaveLength(1);
    expect(agent.configurationFiles[0]!.path).toBe(COPILOT_SETTINGS_PATH);
  });

  describe('preWorkspaceStart', () => {
    test('writes model configuration into settings.json', async () => {
      await activate(extensionContextMock);
      const agent = getRegisteredAgent();

      const configFile = createConfigFile();
      await agent.preWorkspaceStart(createContext([configFile]));

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written).toEqual({
        chat: { model: 'gpt-4o' },
      });
    });

    test('preserves existing configuration fields', async () => {
      await activate(extensionContextMock);
      const agent = getRegisteredAgent();

      const existingConfig = JSON.stringify({ chat: { model: 'old-model', temperature: 0.7 }, other: true });
      const configFile = createConfigFile(existingConfig);
      await agent.preWorkspaceStart(createContext([configFile], 'claude-sonnet'));

      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written.chat.model).toBe('claude-sonnet');
      expect(written.chat.temperature).toBe(0.7);
      expect(written.other).toBe(true);
    });

    test.each([
      'null',
      '"a string"',
      '123',
      'true',
      '[1, 2]',
    ])('falls back to empty config when parsed JSON is non-object: %s', async (payload: string) => {
      await activate(extensionContextMock);
      const agent = getRegisteredAgent();

      const configFile = createConfigFile(payload);
      await agent.preWorkspaceStart(createContext([configFile]));

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written.chat.model).toBe('gpt-4o');
    });

    test('handles invalid JSON by starting with empty config', async () => {
      await activate(extensionContextMock);
      const agent = getRegisteredAgent();

      const configFile = createConfigFile('not valid json');
      await agent.preWorkspaceStart(createContext([configFile]));

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written.chat.model).toBe('gpt-4o');
    });

    test('does nothing when config file is not in context', async () => {
      await activate(extensionContextMock);
      const agent = getRegisteredAgent();

      const updateMock = vi.fn();
      const otherFile: AgentConfigurationFile = {
        path: 'some/other/path.json',
        read: vi.fn(),
        update: updateMock,
      };

      await agent.preWorkspaceStart(createContext([otherFile]));

      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
