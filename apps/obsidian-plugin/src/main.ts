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
      // shortcut: desktop path scopes the manual dev handoff, replace with setup-owned identity wiring in M0.5.
      this.connection = new PluginConnection(
        this.app.vault.adapter.getBasePath(),
        this.manifest.version,
        new LocalStore(),
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
      text: "Plugin connection acceptance does not imply Bootstrap Foundation Healthy. Automatic setup and discovery refresh are pending.",
    });
    if (this.plugin.connection) {
      const form = this.contentEl.createEl("form");
      const label = form.createEl("label", {
        text: "Development connection JSON (discovery, vaultFingerprint and vaultPath)",
      });
      const metadata = label.createEl("textarea", { attr: { rows: "5", spellcheck: "false", autocomplete: "off" } });
      const proofLabel = form.createEl("label", { text: "One-time pairing proof (leave empty to reconnect)" });
      const proof = proofLabel.createEl("input", { type: "password", attr: { autocomplete: "off" } });
      const button = form.createEl("button", { text: "Connect", type: "submit" });
      const feedback = form.createEl("p", { attr: { role: "status" } });
      this.registerDomEvent(form, "submit", (event) => {
        event.preventDefault();
        const once = proof.value;
        proof.value = "";
        button.disabled = true;
        let parsed: unknown;
        try {
          parsed = JSON.parse(metadata.value);
        } catch {
          feedback.textContent = "Invalid JSON.";
          button.disabled = false;
          return;
        }
        void this.plugin.connection
          ?.configure(parsed, once)
          .catch(() => {
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
