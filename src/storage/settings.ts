import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { AppSettings } from "../types/messages";
import { DEFAULT_MODELS } from "../types/provider";

function createDefaultSettings(): AppSettings {
  return {
    defaultProvider: "anthropic",
    providers: {
      anthropic: {
        model: DEFAULT_MODELS.anthropic,
      },
      openai: {
        model: DEFAULT_MODELS.openai,
      },
      "azure-openai": {
        model: DEFAULT_MODELS["azure-openai"],
        endpoint: "",
        deploymentName: "",
      },
      ollama: {
        model: DEFAULT_MODELS.ollama,
        endpoint: "http://localhost:11434",
      },
      openrouter: {
        model: DEFAULT_MODELS.openrouter,
      },
      google: {
        model: DEFAULT_MODELS.google,
        endpoint: "",
      },
    },
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
        await fs.access(this.settingsFile);
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
        // Ensure mcpServers exists
        if (!settings.mcpServers) {
          settings.mcpServers = {};
        }
        if (settings.autoLoadProjectFiles === undefined) {
          settings.autoLoadProjectFiles = true;
        }
        return settings;
      } catch {
        const defaults = createDefaultSettings();
        // Skip calling save() inside enqueue to avoid nested deadlocks,
        // instead just write the file directly since we're already in a queued operation.
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
    // We handle update as a single atomic operation in the queue
    return this.enqueue(async () => {
      let current: AppSettings;
      try {
        const data = await fs.readFile(this.settingsFile, "utf-8");
        current = JSON.parse(data) as AppSettings;
      } catch {
        current = createDefaultSettings();
      }

      const merged: AppSettings = {
        ...current,
        ...partial,
        providers: partial.providers
          ? { ...current.providers, ...partial.providers }
          : current.providers,
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
