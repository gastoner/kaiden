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

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { router } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';

import * as skillsStore from '/@/stores/skills';
import type { AgentWorkspaceConfiguration, AgentWorkspaceSummary } from '/@api/agent-workspace-info';
import type { SkillInfo } from '/@api/skill/skill-info';

import AgentWorkspaceDetailsSettings from './AgentWorkspaceDetailsSettings.svelte';

vi.mock(import('tinro'));
vi.mock(import('/@/stores/skills'));
vi.mock(import('/@/navigation'));

const routerStore = writable({
  path: '/agent-workspaces/ws-1/settings',
  url: '/agent-workspaces/ws-1/settings',
  from: '/',
  query: {} as Record<string, string>,
  hash: '',
});

const workspaceSummary: AgentWorkspaceSummary = {
  id: 'ws-1',
  name: 'api-refactor',
  project: 'backend',
  agent: 'opencode',
  model: 'gpt-4o',
  runtime: 'podman',
  state: 'stopped',
  paths: {
    source: '/home/user/projects/backend',
    configuration: '/home/user/.config/kaiden/workspaces/api-refactor.yaml',
  },
  timestamps: { created: 1700000000000, started: 1700100000000 },
  forwards: [],
};

const configuration: AgentWorkspaceConfiguration = {
  mounts: [{ host: '$SOURCES/../shared-lib', target: '/workspace/shared-lib', ro: false }],
  environment: [{ name: 'API_KEY', value: 'test-key' }],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  vi.mocked(router).subscribe.mockImplementation(routerStore.subscribe);
  vi.mocked(window.updateAgentWorkspaceSummary).mockResolvedValue(undefined);
  vi.mocked(window.updateAgentWorkspaceConfiguration).mockResolvedValue(undefined);
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([]);
});

test('Expect General section is active by default with workspace info', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  expect(screen.getByText('Workspace Information')).toBeInTheDocument();
});

test('Expect workspace name is displayed in input', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  expect(nameInput).toHaveValue('api-refactor');
});

test('Expect working directory is displayed in input', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const dirInput = screen.getByRole('textbox', { name: 'Working Directory' });
  expect(dirInput).toHaveValue('/home/user/projects/backend');
});

test('Expect all settings nav sections are rendered', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  for (const label of ['General', 'Agent Skills', 'MCP Servers', 'Knowledge', 'File Access', 'Network', 'Advanced']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
  }
});

test('Expect workspace name input is editable', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  expect(nameInput).not.toHaveAttribute('readonly');
  await fireEvent.input(nameInput, { target: { value: 'new-name' } });
  expect(nameInput).toHaveValue('new-name');
});

test('Expect save/discard bar shown when workspace name is modified', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'renamed' } });

  expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Discard changes' })).toBeInTheDocument();
});

test('Expect save/discard bar not shown when workspace name matches original', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'api-refactor' } });

  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
});

test('Expect clicking Save changes calls updateAgentWorkspaceSummary', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'renamed' } });
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceSummary).toHaveBeenCalledWith('ws-1', { name: 'renamed' });
});

test('Expect clicking Discard changes resets workspace name to original', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'renamed' } });
  await fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

  expect(nameInput).toHaveValue('api-refactor');
  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
  expect(window.updateAgentWorkspaceSummary).not.toHaveBeenCalled();
});

test('Expect no save when workspace name has not changed', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'api-refactor' } });

  expect(window.updateAgentWorkspaceSummary).not.toHaveBeenCalled();
});

test('Expect working directory input is readonly', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const dirInput = screen.getByRole('textbox', { name: 'Working Directory' });
  expect(dirInput).toHaveAttribute('readonly');
});

test('Expect empty inputs when workspace summary is undefined', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary: undefined, configuration: {} });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  expect(nameInput).toHaveValue('');

  const dirInput = screen.getByRole('textbox', { name: 'Working Directory' });
  expect(dirInput).toHaveValue('');
});

test('Expect skills checklist shown when switching to Agent Skills section', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));

  expect(screen.getByText('Skills')).toBeInTheDocument();
  expect(screen.getByText('kubernetes')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Manage Skills' })).toBeInTheDocument();
});

test('Expect empty state when no skills available', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));

  expect(screen.getByText('No skills available yet.')).toBeInTheDocument();
});

test('Expect configured skills are pre-selected', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
    { name: 'code-review', description: 'Analyze code', path: '/skills/code-review', enabled: true, managed: true },
  ]);

  const configWithSkills: AgentWorkspaceConfiguration = {
    ...configuration,
    skills: ['/skills/kubernetes'],
  };

  render(AgentWorkspaceDetailsSettings, {
    workspaceId: 'ws-1',
    workspaceSummary,
    configuration: configWithSkills,
  });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));

  expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
});

test('Expect toggling a skill shows save bar without immediate save', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));

  expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  expect(window.updateAgentWorkspaceConfiguration).not.toHaveBeenCalled();
});

test('Expect Save changes persists skill selection', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    skills: ['/skills/kubernetes'],
  });
});

test('Expect Discard changes resets skill selection', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
  expect(window.updateAgentWorkspaceConfiguration).not.toHaveBeenCalled();
});

test('Expect removing all skills saves undefined when Save changes clicked', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  const configWithSkills: AgentWorkspaceConfiguration = {
    ...configuration,
    skills: ['/skills/kubernetes'],
  };

  render(AgentWorkspaceDetailsSettings, {
    workspaceId: 'ws-1',
    workspaceSummary,
    configuration: configWithSkills,
  });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    skills: undefined,
  });
});

test('Expect all skills shown including disabled ones', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
    { name: 'disabled-skill', description: 'Not active', path: '/skills/disabled', enabled: false, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));

  expect(screen.getByText('kubernetes')).toBeInTheDocument();
  expect(screen.getByText('disabled-skill')).toBeInTheDocument();
});

test('Expect Manage Skills button navigates to skills page', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Manage Skills' }));

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'skills' });
});

test('Expect switching to a placeholder section shows future update message', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'MCP Servers' }));

  expect(screen.getByText('MCP Servers settings will be available in a future update.')).toBeInTheDocument();
});
