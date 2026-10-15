import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  FileSystemAdapter: class {
    getBasePath() {
      return "/synthetic/vault";
    }
  },
  Plugin: class {
    registerView = vi.fn();
    addCommand = vi.fn();
    addRibbonIcon = vi.fn();
    registerInterval = vi.fn();
  },
  ItemView: class {},
}));

import { FileSystemAdapter } from "obsidian";
import IdeomyPlugin from "./main.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function pluginFixture(desktop: boolean) {
  let ready: (() => void) | undefined;
  const workspace = {
    onLayoutReady: vi.fn((callback: () => void) => {
      ready = callback;
    }),
    getLeavesOfType: vi.fn(() => []),
    detachLeavesOfType: vi.fn(),
  };
  const app = { workspace, vault: { adapter: desktop ? new FileSystemAdapter() : {} } };
  const plugin = Object.assign(new IdeomyPlugin(app as never, { version: "0.0.1" } as never), {
    app,
    manifest: { version: "0.0.1" },
  });
  return { plugin, workspace, ready: () => ready?.() };
}

describe("Plugin lifecycle", () => {
  it("registers only lightweight UI before layout ready and degrades on mobile", () => {
    const { plugin, ready } = pluginFixture(false);
    plugin.onload();
    expect(plugin.registerView).toHaveBeenCalledOnce();
    expect(plugin.connection).toBeUndefined();
    ready();
    expect(plugin.connection).toBeUndefined();
    plugin.onunload();
  });

  it("defers Core work and cleans connection/views on unload", () => {
    vi.stubGlobal("window", { setInterval: vi.fn(() => 1) });
    const { plugin, ready, workspace } = pluginFixture(true);
    plugin.onload();
    expect(plugin.connection).toBeUndefined();
    ready();
    expect(plugin.connection).toBeDefined();
    if (!plugin.connection) throw new Error("Expected desktop connection.");
    const stop = vi.spyOn(plugin.connection, "stop");
    plugin.onunload();
    expect(stop).toHaveBeenCalledOnce();
    expect(workspace.detachLeavesOfType).toHaveBeenCalledWith("ideomy");
    expect(plugin.connection).toBeUndefined();
    ready();
    expect(plugin.connection).toBeUndefined();
  });
});
