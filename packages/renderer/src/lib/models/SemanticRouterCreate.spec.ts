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

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { CatalogModelInfo } from '/@/lib/models/models-utils';
import * as modelsStore from '/@/stores/models';
import { resetRouterDraft } from '/@/stores/semantic-router-create-draft.svelte';

import SemanticRouterCreate from './SemanticRouterCreate.svelte';

vi.mock(import('/@/navigation'));
vi.mock(import('/@/stores/models'));

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetRouterDraft();
  vi.mocked(window.createSemanticRouter).mockResolvedValue({
    name: 'test-router',
    listeners: [{ address: '0.0.0.0', port: 8899 }],
    routing: { keywords: [], decisions: [] },
  });
  vi.mocked(modelsStore).catalogModels = writable<CatalogModelInfo[]>([
    {
      providerId: 'gemini',
      connectionId: 'conn-1',
      connectionName: 'Gemini',
      type: 'cloud',
      label: 'gemini-2.5-pro',
      connectionStatus: 'started',
      providerName: 'Gemini',
    },
  ]);
});

describe('basic setup step', () => {
  test('renders the form title', () => {
    render(SemanticRouterCreate);

    screen.getByText('Configure a Semantic Router');
  });

  test('renders all form fields', () => {
    render(SemanticRouterCreate);

    screen.getByLabelText('Router name');
    screen.getByLabelText('Description');
    screen.getByLabelText('Listener address');
    screen.getByLabelText('Listener port');
    screen.getByLabelText('Timeout');
  });

  test('next button is disabled when name is empty', () => {
    render(SemanticRouterCreate);

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    expect(nextBtn).toBeDisabled();
  });

  test('next button is enabled when name is provided', async () => {
    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    expect(nextBtn).toBeEnabled();
  });
});

describe('step navigation', () => {
  test('navigates to signals step when Next is clicked', async () => {
    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.click(nextBtn);

    screen.getByText('Signals');
    screen.getByText('Decisions');
  });

  test('Back button appears on step 2 and navigates back', async () => {
    render(SemanticRouterCreate);

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.click(nextBtn);

    const backBtn = screen.getByRole('button', { name: 'Back' });
    await fireEvent.click(backBtn);

    screen.getByLabelText('Router name');
  });

  test('shows Create button on last step', async () => {
    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.click(nextBtn);

    screen.getByRole('button', { name: 'Create' });
  });

  test('step counter updates as steps change', async () => {
    render(SemanticRouterCreate);

    screen.getByText('Step 1 of 2');

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.click(nextBtn);

    screen.getByText('Step 2 of 2');
  });
});

describe('skip and create from step 1', () => {
  test('skip button is disabled when name is empty', () => {
    render(SemanticRouterCreate);

    const skipBtn = screen.getByRole('button', { name: /Skip signals and create router/i });
    expect(skipBtn).toBeDisabled();
  });

  test('skip button is enabled when name is provided', async () => {
    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const skipBtn = screen.getByRole('button', { name: /Skip signals and create router/i });
    expect(skipBtn).toBeEnabled();
  });

  test('creates router with empty signals and decisions when skip is clicked', async () => {
    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'quick-router' } });

    const skipBtn = screen.getByRole('button', { name: /Skip signals and create router/i });
    await fireEvent.click(skipBtn);
    await vi.advanceTimersToNextTimerAsync();

    expect(window.createSemanticRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'quick-router',
        routing: { keywords: [], decisions: [] },
      }),
    );

    const { handleNavigation } = await import('/@/navigation');
    await waitFor(() => {
      expect(handleNavigation).toHaveBeenCalledWith({ page: 'semantic-routers' });
    });
  });

  test('skip button is not shown on step 2', async () => {
    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.click(nextBtn);

    expect(screen.queryByRole('button', { name: /Skip signals/i })).not.toBeInTheDocument();
  });
});

describe('create flow', () => {
  test('calls createSemanticRouter on final step', async () => {
    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.click(nextBtn);

    const createBtn = screen.getByRole('button', { name: 'Create' });
    await fireEvent.click(createBtn);
    await vi.advanceTimersToNextTimerAsync();

    expect(window.createSemanticRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'my-router',
        listeners: expect.arrayContaining([expect.objectContaining({ port: 8899 })]),
        routing: { keywords: [], decisions: [] },
      }),
    );
  });

  test('navigates to semantic routers page after creation', async () => {
    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.click(nextBtn);

    const createBtn = screen.getByRole('button', { name: 'Create' });
    await fireEvent.click(createBtn);
    await vi.advanceTimersToNextTimerAsync();

    const { handleNavigation } = await import('/@/navigation');
    await waitFor(() => {
      expect(handleNavigation).toHaveBeenCalledWith({ page: 'semantic-routers' });
    });
  });

  test('displays error when createSemanticRouter fails', async () => {
    vi.mocked(window.createSemanticRouter).mockRejectedValueOnce(new Error('duplicate name'));

    render(SemanticRouterCreate);

    const nameInput = screen.getByLabelText('Router name');
    await fireEvent.input(nameInput, { target: { value: 'my-router' } });

    const nextBtn = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.click(nextBtn);

    const createBtn = screen.getByRole('button', { name: 'Create' });
    await fireEvent.click(createBtn);
    await vi.advanceTimersToNextTimerAsync();

    await waitFor(() => {
      screen.getByText('Error: duplicate name');
    });
  });

  test('navigates to semantic routers page on cancel', async () => {
    render(SemanticRouterCreate);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await fireEvent.click(cancelBtn);

    const { handleNavigation } = await import('/@/navigation');
    expect(handleNavigation).toHaveBeenCalledWith({ page: 'semantic-routers' });
  });
});
