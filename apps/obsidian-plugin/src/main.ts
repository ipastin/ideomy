import { FileSystemAdapter, ItemView, Plugin, type WorkspaceLeaf } from "obsidian";
import { PluginConnection } from "./connection.ts";
import { LocalStore } from "./storage.ts";

const VIEW = "ideomy";

export default class IdeomyPlugin extends Plugin {
  connection: PluginConnection | undefined;
  private disposed = false;

  onload(): void {
    this.registerView(VIEW, (leaf) => new IdeomyView(leaf, this));
    this.addCommand({ id: "open", name: "Open Ideomy", callback: () => void this.openView() });
    this.addRibbonIcon("brain", "Open Ideomy", () => void this.openView());
    this.app.workspace.onLayoutReady(() => {
      if (this.disposed || !(this.app.vault.adapter instanceof FileSystemAdapter)) return;
      this.connection = new PluginConnection(
        this.app.vault.adapter.getBasePath(),
        this.manifest.version,
        new LocalStore(),
        fetch,
        async () => {
          // Setup owns this non-secret hint; Core's authoritative discovery stays machine-local.
          const path = `${this.app.vault.configDir}/plugins/ideomy/connection.json`;
          if (!(await this.app.vault.adapter.exists(path))) return undefined;
          return JSON.parse(await this.app.vault.adapter.read(path));
        },
      );
      this.registerInterval(window.setInterval(() => void this.connection?.connect(), 30_000));
      void this.connection.connect();
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
        if (leaf.view instanceof IdeomyView) leaf.view.bind();
      }
    });
  }

  private async openView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW)[0];
    const leaf = existing ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    if (!existing) await leaf.setViewState({ type: VIEW, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  onunload(): void {
    this.disposed = true;
    this.connection?.stop();
    this.connection = undefined;
    this.app.workspace.detachLeavesOfType(VIEW);
  }
}

class IdeomyView extends ItemView {
  private unsubscribe: (() => void) | undefined;
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: IdeomyPlugin,
  ) {
    super(leaf);
  }
  getViewType(): string {
    return VIEW;
  }
  getDisplayText(): string {
    return "Ideomy";
  }
  async onOpen(): Promise<void> {
    this.bind();
  }
  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.contentEl.empty();
  }

  bind(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.plugin.connection?.subscribe(() => this.renderStatus());
    this.render();
  }

  private renderStatus(): void {
    const status = this.contentEl.querySelector("[data-ideomy-status]");
    if (!status) return;
    const connection = this.plugin.connection;
    status.textContent = connection
      ? `${connection.state.state}: ${connection.state.message}`
      : "Core unavailable on mobile or workspace not ready.";
    const details = this.contentEl.querySelector("[data-ideomy-identity]");
    if (details)
      details.textContent = connection?.state.handshake
        ? `Core ${connection.state.handshake.core_version}; Vault ${connection.state.handshake.vault_id}; fingerprint ${connection.state.handshake.vault_fingerprint}`
        : "Vault identity: not authenticated.";
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Ideomy" });
    this.contentEl.createEl("p", { text: `Plugin ${this.plugin.manifest.version} · development Plugin P0` });
    this.contentEl.createEl("p", { attr: { "data-ideomy-status": "", role: "status" } });
    this.contentEl.createEl("p", { attr: { "data-ideomy-identity": "" } });
    this.contentEl.createEl("p", {
      text: "Setup supplies Core connection metadata. Enter its one-time pairing proof below to authorize this device.",
    });
    if (this.plugin.connection) {
      const form = this.contentEl.createEl("form");
      form.style.display = "grid";
      form.style.gap = "var(--size-4-2)";
      const label = form.createEl("label", {
        text: "Optional development connection JSON (leave empty to use setup)",
      });
      label.style.display = "grid";
      const metadata = label.createEl("textarea", { attr: { rows: "5", spellcheck: "false", autocomplete: "off" } });
      metadata.style.width = "100%";
      const proofLabel = form.createEl("label", { text: "One-time pairing proof (leave empty to reconnect)" });
      proofLabel.style.display = "grid";
      const proof = proofLabel.createEl("input", { type: "password", attr: { autocomplete: "off" } });
      proof.style.width = "100%";
      const button = form.createEl("button", { text: "Connect", type: "submit" });
      button.style.justifySelf = "start";
      const feedback = form.createEl("p", { attr: { role: "status" } });
      this.registerDomEvent(form, "submit", (event) => {
        event.preventDefault();
        feedback.textContent = "";
        const once = proof.value;
        proof.value = "";
        button.disabled = true;
        let parsed: unknown;
        try {
          if (metadata.value.trim()) parsed = JSON.parse(metadata.value);
        } catch {
          feedback.textContent = "Invalid JSON.";
          button.disabled = false;
          return;
        }
        const connection = this.plugin.connection;
        if (!connection) {
          button.disabled = false;
          return;
        }
        void (metadata.value.trim() ? connection.configure(parsed, once) : connection.connect(once))
          .catch(() => {
            if (this.plugin.connection?.state.state !== "wrong-vault")
              feedback.textContent = "Invalid metadata or unavailable local storage.";
          })
          .finally(() => {
            button.disabled = false;
          });
      });
    }
    this.renderStatus();
  }
}
