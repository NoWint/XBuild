// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TID_COMPOSER_WORKSPACE_TRIGGER,
  TID_LOGIN_API_KEY_CONTINUE_BUTTON,
  TID_LOGIN_API_KEY_INPUT,
  TID_TASK_NEW_BUTTON,
  TID_TASK_SETTINGS_BUTTON,
  TID_V4_COMPOSER_INPUT,
  TID_V4_SESSION_PANE,
  testId,
} from "@zcode/shared/test-ids";
import {
  clickTestIdByDom,
  DEFAULT_WORKSPACE,
  waitForDefaultWorkspaceReady,
} from "#e2e/helpers/desktop-app";
import { startDraftFromProject, waitForProjectRow } from "#e2e/helpers/project-sidebar";
import { ensureUpstreamProviderForE2E, selectUpstreamModel } from "#e2e/helpers/upstream-provider";
import { skipOccupationOnboardingIfPresent } from "#e2e/helpers/occupation-onboarding";
import {
  LOGIN_API_KEY,
  loginWithApiKey,
  prepareV4ConversationE2E,
  startNewV4Draft,
} from "#e2e/helpers/v4-conversation";

vi.mock("./e2e/helpers/desktop-app.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./e2e/helpers/desktop-app.js")>();
  return {
    ...actual,
    DEFAULT_WORKSPACE: "/Users/dev/e2e/ZCodeProject",
    clickTestIdByDom: vi.fn(actual.clickTestIdByDom),
    waitForDefaultWorkspaceReady: vi.fn(),
  };
});
vi.mock("./e2e/helpers/project-sidebar.js", () => ({
  projectNameForWorkspace: () => "ZCodeProject",
  startDraftFromProject: vi.fn(),
  waitForProjectRow: vi.fn(),
}));
vi.mock("./e2e/helpers/upstream-provider.js", () => ({
  ensureUpstreamProviderForE2E: vi.fn(),
  selectUpstreamModel: vi.fn(),
  selectUpstreamThoughtLevel: vi.fn(),
}));
vi.mock("./e2e/helpers/occupation-onboarding.js", () => ({
  skipOccupationOnboardingIfPresent: vi.fn(),
}));

function renderDraft({
  path = DEFAULT_WORKSPACE,
  project = "ZCodeProject",
  session = "draft",
  text = "",
} = {}) {
  document.body.innerHTML = `<div data-testid="${testId(TID_V4_SESSION_PANE, "workspace-main")}" data-session-id="${session}"><div data-testid="${TID_V4_COMPOSER_INPUT}" contenteditable="true">${text}</div></div><button data-testid="${TID_COMPOSER_WORKSPACE_TRIGGER}">${project}</button><button data-testid="${TID_TASK_SETTINGS_BUTTON}">Settings</button><button data-testid="${TID_TASK_NEW_BUTTON}">New task</button>`;
  document
    .querySelector(`[data-testid="${TID_TASK_NEW_BUTTON}"]`)
    ?.addEventListener("click", () => {
      renderDraft({ project: "" });
    });
  vi.stubGlobal("__zcodeTabStoreE2E", { getState: () => ({ activeWorkspacePath: path }) });
}

function renderApiKeyForm(submittedKeys: string[]) {
  document.body.innerHTML = `<input type="password" data-testid="${TID_LOGIN_API_KEY_INPUT}" value=""><button type="button" data-testid="${TID_LOGIN_API_KEY_CONTINUE_BUTTON}" disabled>Continue</button>`;
  const input = document.querySelector<HTMLInputElement>(
    `[data-testid="${TID_LOGIN_API_KEY_INPUT}"]`,
  )!;
  const button = document.querySelector<HTMLButtonElement>(
    `[data-testid="${TID_LOGIN_API_KEY_CONTINUE_BUTTON}"]`,
  )!;
  input.addEventListener("input", () => {
    button.disabled = !input.value.trim();
  });
  button.addEventListener("click", () => {
    submittedKeys.push(input.value);
    renderDraft();
  });
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
    function (this: HTMLElement) {
      return (this.closest("[hidden]") ? [] : [{}]) as DOMRectList;
    },
  );
  vi.stubGlobal("browser", {
    execute: async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
    pause: async () => undefined,
    waitUntil: async (predicate: () => Promise<boolean>, options: { timeoutMsg: string }) => {
      if (!(await predicate())) throw new Error(options.timeoutMsg);
    },
  });
  vi.mocked(startDraftFromProject).mockImplementation(async () => {
    renderDraft();
  });
  vi.mocked(skipOccupationOnboardingIfPresent).mockImplementation(async () => {
    if (
      document
        .querySelector<HTMLElement>(`[data-testid="${TID_LOGIN_API_KEY_INPUT}"]`)
        ?.getClientRects().length
    ) {
      throw new Error("API Key form does not expose onboarding or shell readiness");
    }
    if (document.querySelector('[data-testid="onboarding-page"]')) renderDraft();
  });
  renderDraft();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("V4 conversation E2E preparation", () => {
  it("uses the visible current API-key form without the removed chooser", async () => {
    const submittedKeys: string[] = [];
    renderApiKeyForm(submittedKeys);

    await loginWithApiKey();

    expect(submittedKeys).toEqual([LOGIN_API_KEY]);
    expect(document.querySelector(`[data-testid="${TID_V4_COMPOSER_INPUT}"]`)).not.toBeNull();
  });

  it("handles the direct API-key form before waiting for onboarding or projects", async () => {
    const submittedKeys: string[] = [];
    renderApiKeyForm(submittedKeys);

    await prepareV4ConversationE2E();

    expect(submittedKeys).toEqual([LOGIN_API_KEY]);
    expect(document.querySelector(`[data-testid="${TID_LOGIN_API_KEY_INPUT}"]`)).toBeNull();
    expect(document.querySelector(`[data-testid="${TID_V4_COMPOSER_INPUT}"]`)).not.toBeNull();
    expect(startDraftFromProject).not.toHaveBeenCalled();
    expect(selectUpstreamModel).toHaveBeenCalledOnce();
  });

  it("does not submit API-key login for a seeded ready shell", async () => {
    await prepareV4ConversationE2E();

    expect(clickTestIdByDom).not.toHaveBeenCalled();
    expect(document.querySelector(`[data-testid="${TID_V4_COMPOSER_INPUT}"]`)).not.toBeNull();
  });

  it("does not route a ready shell through a hidden API-key form", async () => {
    const hiddenForm = document.createElement("div");
    hiddenForm.hidden = true;
    hiddenForm.innerHTML = `<input type="password" data-testid="${TID_LOGIN_API_KEY_INPUT}"><button data-testid="${TID_LOGIN_API_KEY_CONTINUE_BUTTON}">Continue</button>`;
    document.body.prepend(hiddenForm);

    await prepareV4ConversationE2E();

    expect(clickTestIdByDom).not.toHaveBeenCalled();
    expect(
      document.querySelector<HTMLInputElement>(`[data-testid="${TID_LOGIN_API_KEY_INPUT}"]`)?.value,
    ).toBe("");
    expect(document.querySelector(`[data-testid="${TID_V4_COMPOSER_INPUT}"]`)).not.toBeNull();
  });

  it("finishes an existing onboarding surface without invoking login", async () => {
    document.body.innerHTML = '<div data-testid="onboarding-page"></div>';

    await prepareV4ConversationE2E();

    expect(clickTestIdByDom).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="onboarding-page"]')).toBeNull();
    expect(document.querySelector(`[data-testid="${TID_V4_COMPOSER_INPUT}"]`)).not.toBeNull();
  });

  it("reuses an empty fixture project draft across repeated preparation", async () => {
    await prepareV4ConversationE2E();
    await prepareV4ConversationE2E();
    expect(startDraftFromProject).not.toHaveBeenCalled();
    expect(clickTestIdByDom).not.toHaveBeenCalled();
    expect(selectUpstreamModel).toHaveBeenCalledTimes(2);
  });

  it.each([
    { path: "/Users/dev/e2e/.zcode/workspace/generated", project: "" },
    { session: "existing-session" },
    { text: "unsent draft from previous case" },
  ])("returns to the fixture project before checking its cwd: %j", async (state) => {
    renderDraft(state);
    await prepareV4ConversationE2E();
    expect(waitForProjectRow).toHaveBeenCalledWith(DEFAULT_WORKSPACE, expect.anything());
    expect(startDraftFromProject).toHaveBeenCalledExactlyOnceWith(DEFAULT_WORKSPACE);
    expect(vi.mocked(startDraftFromProject).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(waitForDefaultWorkspaceReady).mock.invocationCallOrder[0]!,
    );
    expect(vi.mocked(startDraftFromProject).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(ensureUpstreamProviderForE2E).mock.invocationCallOrder[0]!,
    );
    expect(clickTestIdByDom).not.toHaveBeenCalled();
  });

  it.each(["", "Another project"])(
    "reuses an empty fixture cwd without changing its project label: %s",
    async (project) => {
      renderDraft({ project });
      await prepareV4ConversationE2E();
      expect(startDraftFromProject).not.toHaveBeenCalled();
      expect(clickTestIdByDom).not.toHaveBeenCalled();
    },
  );

  it("preserves a caller-owned workspace when shell preparation is disabled", async () => {
    renderDraft({ path: "/remote/workspace", project: "Remote project" });
    await prepareV4ConversationE2E({ skipShellReady: true });
    expect(startDraftFromProject).not.toHaveBeenCalled();
    expect(waitForProjectRow).not.toHaveBeenCalled();
    expect(waitForDefaultWorkspaceReady).not.toHaveBeenCalled();
    expect(clickTestIdByDom).not.toHaveBeenCalled();
  });

  it("keeps explicit global New Task as a real click", async () => {
    await startNewV4Draft();
    expect(clickTestIdByDom).toHaveBeenCalledWith(TID_TASK_NEW_BUTTON, expect.anything());
    expect(startDraftFromProject).not.toHaveBeenCalled();
  });
});
