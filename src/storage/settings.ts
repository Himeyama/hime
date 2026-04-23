import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { AppSettings } from "../types/messages";

function createDefaultSettings(): AppSettings {
  return {
    defaultModelId: "",
    models: [],
    systemPrompt: "",
    mcpServers: {},
    autoLoadProjectFiles: true,
  };
}

export class SettingsStorage {
  private queue: Promise<any> = Promise.resolve();

  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  private get baseDir(): string {
    return path.join(os.homedir(), ".hime");
  }

  private get settingsFile(): string {
    return path.join(this.baseDir, "settings.json");
  }

  async initialize(): Promise<void> {
    return this.enqueue(async () => {
      await fs.mkdir(this.baseDir, { recursive: true });
      try {
        const data = await fs.readFile(this.settingsFile, "utf-8");
        const parsed = JSON.parse(data);
        // 旧形式 (providers フィールドあり) は新形式にリセット
        if (parsed.providers !== undefined || parsed.defaultProvider !== undefined) {
          const defaults = createDefaultSettings();
          await fs.writeFile(this.settingsFile, JSON.stringify(defaults, null, 2), "utf-8");
        }
      } catch {
        const defaults = createDefaultSettings();
        await fs.writeFile(this.settingsFile, JSON.stringify(defaults, null, 2), "utf-8");
      }
    });
  }

  async load(): Promise<AppSettings> {
    return this.enqueue(async () => {
      try {
        const data = await fs.readFile(this.settingsFile, "utf-8");
        const settings = JSON.parse(data) as AppSettings;
        if (!settings.models) settings.models = [];
        if (settings.defaultModelId === undefined) settings.defaultModelId = "";
        if (!settings.mcpServers) settings.mcpServers = {};
        if (settings.autoLoadProjectFiles === undefined) settings.autoLoadProjectFiles = true;
        return settings;
      } catch {
        const defaults = createDefaultSettings();
        await fs.mkdir(this.baseDir, { recursive: true });
        await fs.writeFile(this.settingsFile, JSON.stringify(defaults, null, 2), "utf-8");
        return defaults;
      }
    });
  }

  async save(settings: AppSettings): Promise<void> {
    return this.enqueue(async () => {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.writeFile(this.settingsFile, JSON.stringify(settings, null, 2), "utf-8");
    });
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    return this.enqueue(async () => {
      let current: AppSettings;
      try {
        const data = await fs.readFile(this.settingsFile, "utf-8");
        current = JSON.parse(data) as AppSettings;
        if (!current.models) current.models = [];
      } catch {
        current = createDefaultSettings();
      }

      const merged: AppSettings = {
        ...current,
        ...partial,
        mcpServers: partial.mcpServers !== undefined
          ? partial.mcpServers
          : current.mcpServers,
      };

      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.writeFile(this.settingsFile, JSON.stringify(merged, null, 2), "utf-8");
      return merged;
    });
  }
}
