import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import * as os from "os";
import * as dns from "dns";

// Fix for Node.js 18+ native fetch timeouts when IPv6 routing is broken
dns.setDefaultResultOrder("ipv4first");

import { ChatHistoryStorage } from "./storage/chat-history";
import { SettingsStorage } from "./storage/settings";
import { MCPClientManager } from "./mcp/client";
import { ToolExecutor } from "./mcp/tool-executor";
import { createProvider } from "./providers/index";
import { ActiveEditorTracker } from "./context/active-editor";
import { loadProjectContext } from "./context/workspace-files";
import { buildSystemPromptParts } from "./context/system-prompt";
import { loadAllSkills, findSkill, expandSkillPrompt, buildSkillsHelpText, buildHelpText } from "./skills/loader";
import { ProviderType, Message, ModelEntry, generateModelDisplayName } from "./types/chat";
import { AIProvider, ProviderConfig } from "./types/provider";
import { WebviewToExtensionMessage, ExtensionToWebviewMessage, AppSettings } from "./types/messages";

let chatStorage: ChatHistoryStorage;
let settingsStorage: SettingsStorage;
let mcpClient: MCPClientManager;
let toolExecutor: ToolExecutor;
let activeEditorTracker: ActiveEditorTracker;
let currentAbortController: AbortController | null = null;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Hime");
  context.subscriptions.push(outputChannel);

  chatStorage = new ChatHistoryStorage(outputChannel);
  settingsStorage = new SettingsStorage();
  await chatStorage.initialize();
  await settingsStorage.initialize();

  mcpClient = new MCPClientManager(outputChannel);
  toolExecutor = new ToolExecutor(mcpClient);

  const provider = new HimeChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("hime.chatView", provider)
  );

  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspacePath) {
    settingsStorage.load().then(async (settings) => {
      try {
        await mcpClient.connectAll(workspacePath, settings.mcpServers);
      } catch (err) {
        console.error("MCP connection error:", err);
      }
      provider.sendMcpStatus();
    });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("hime.newChat", () => {
      provider.postMessage({ command: "createChat" } as any);
    }),
    vscode.commands.registerCommand("hime.clearContext", () => {
      provider.postMessage({ command: "clearContext" } as any);
    }),
    vscode.commands.registerCommand("hime.compressContext", () => {
      provider.postMessage({ command: "compressContext" } as any);
    }),
    vscode.commands.registerCommand("hime.sendSelection", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.document.getText(editor.selection);
        if (selection && provider.webviewView) {
          provider.sendToWebview({
            type: "token",
            chatId: "",
            messageId: "",
            content: selection,
          });
        }
      }
    })
  );

  activeEditorTracker = new ActiveEditorTracker((filePath, language) => {
    if (provider.webviewView) {
      provider.sendToWebview({ type: "activeEditorChanged", filePath, language });
    }
  });
  context.subscriptions.push({ dispose: () => activeEditorTracker.dispose() });
}

export function deactivate() {
  mcpClient?.disconnectAll();
  activeEditorTracker?.dispose();
}

class HimeChatViewProvider implements vscode.WebviewViewProvider {
  webviewView: vscode.WebviewView | undefined;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => this.handleMessage(message)
    );
  }

  sendToWebview(message: ExtensionToWebviewMessage) {
    this.webviewView?.webview.postMessage(message);
  }

  postMessage(message: any) {
    this.handleMessage(message);
  }

  private async handleMessage(message: WebviewToExtensionMessage) {
    try {
      switch (message.command) {
        case "createChat": {
          const settings = await settingsStorage.load();
          const entry = settings.models.find((m) => m.id === settings.defaultModelId);
          const providerType = entry?.provider || "anthropic";
          const chat = await chatStorage.createChat(providerType);
          this.sendToWebview({ type: "chatCreated", chat });
          await this.sendChatList();
          break;
        }
        case "loadChat": {
          const chat = await chatStorage.loadChat(message.chatId);
          this.sendToWebview({ type: "chatLoaded", chat });
          break;
        }
        case "deleteChat": {
          outputChannel.appendLine(`[Storage] Deleting chat: ${message.chatId}`);
          if (!message.chatId) {
            outputChannel.appendLine(`[Storage] Error: No chatId provided for deletion`);
            break;
          }
          await chatStorage.deleteChat(message.chatId);
          const chats = await chatStorage.listChats();
          outputChannel.appendLine(`[Storage] Chat list updated, count: ${chats.length}`);
          this.sendToWebview({ type: "chatListUpdate", chats });
          break;
        }
        case "sendMessage": {
          await this.handleSendMessage(message.chatId, message.content, message.modelId, message.attachments);
          break;
        }
        case "abortStream": {
          currentAbortController?.abort();
          currentAbortController = null;
          break;
        }
        case "clearContext": {
          const chat = await chatStorage.loadChat(message.chatId);
          const clearMessage: Message = {
            id: crypto.randomUUID(),
            role: "system",
            content: "コンテキストがクリアされました",
            timestamp: new Date().toISOString(),
            contextClearMark: true,
          };
          chat.messages.push(clearMessage);
          chat.updatedAt = new Date().toISOString();
          await chatStorage.saveChat(chat);
          this.sendToWebview({ type: "chatLoaded", chat });
          break;
        }
        case "compressContext": {
          await this.handleCompressContext(message.chatId);
          break;
        }
        case "saveModel": {
          const settings = await settingsStorage.load();
          const { entry: entryData, apiKey } = message;

          if (apiKey && entryData.provider !== "ollama") {
            await this.context.secrets.store(`hime.apiKey.${entryData.provider}`, apiKey);
          }

          const newEntry: ModelEntry = {
            id: crypto.randomUUID(),
            provider: entryData.provider,
            model: entryData.model,
            endpoint: entryData.endpoint,
            deploymentName: entryData.deploymentName,
            displayName: generateModelDisplayName(entryData.provider, entryData.model),
          };

          settings.models.push(newEntry);

          if (!settings.defaultModelId || !settings.models.find((m) => m.id === settings.defaultModelId)) {
            settings.defaultModelId = newEntry.id;
          }

          await settingsStorage.save(settings);
          await this.sendSettings();
          break;
        }
        case "deleteModel": {
          const settings = await settingsStorage.load();
          settings.models = settings.models.filter((m) => m.id !== message.modelId);
          if (settings.defaultModelId === message.modelId) {
            settings.defaultModelId = settings.models[0]?.id || "";
          }
          await settingsStorage.save(settings);
          await this.sendSettings();
          break;
        }
        case "reorderModels": {
          const settings = await settingsStorage.load();
          const idOrder = message.modelIds;
          const reordered = idOrder
            .map((id) => settings.models.find((m) => m.id === id))
            .filter((m): m is ModelEntry => !!m);
          await settingsStorage.update({ models: reordered });
          await this.sendSettings();
          break;
        }
        case "setDefaultModel": {
          await settingsStorage.update({ defaultModelId: message.modelId });
          await this.sendSettings();
          break;
        }
        case "getSettings": {
          await this.sendSettings();
          break;
        }
        case "updateSettings": {
          await settingsStorage.update(message.settings);
          await this.sendSettings();
          break;
        }
        case "deleteApiKey": {
          await this.context.secrets.delete(`hime.apiKey.${message.provider}`);
          await this.sendSettings();
          break;
        }
        case "testConnection": {
          await this.handleTestConnection(message.modelId);
          break;
        }
        case "listMcpTools": {
          const tools = toolExecutor.getToolDefinitions();
          this.sendToWebview({ type: "mcpTools", tools });
          break;
        }
        case "reconnectMcp": {
          await this.handleReconnectMcp();
          break;
        }
        case "openSettingsJson": {
          const settingsPath = path.join(os.homedir(), ".hime", "settings.json");
          const uri = vscode.Uri.file(settingsPath);
          await vscode.window.showTextDocument(uri);
          break;
        }
        case "getChatList": {
          await this.sendChatList();
          break;
        }
        case "getMcpStatus": {
          this.sendMcpStatus();
          break;
        }
        case "executeSkill": {
          await this.handleExecuteSkill(message.chatId, message.skillName, message.args, message.modelId);
          break;
        }
        case "listSkills": {
          await this.handleListSkills();
          break;
        }
        case "listHelp": {
          await this.handleListHelp();
          break;
        }
        case "addReaction": {
          const chat = await chatStorage.loadChat(message.chatId);
          const msg = chat.messages.find((m: Message) => m.id === message.messageId);
          if (msg) {
            const reactions = msg.reactions || [];
            const existing = reactions.findIndex((r: any) => r.type === message.reaction);
            if (existing >= 0) {
              reactions.splice(existing, 1);
            } else {
              reactions.push({ type: message.reaction, messageId: message.messageId });
            }
            msg.reactions = reactions;
            await chatStorage.saveChat(chat);
          }
          break;
        }
      }
    } catch (err: any) {
      console.error("Error handling message:", err);
    }
  }

  private async handleSendMessage(
    chatId: string,
    content: string,
    modelId: string,
    attachments?: import("./types/chat").Attachment[]
  ) {
    const settings = await settingsStorage.load();
    const entry = settings.models.find((m) => m.id === modelId);
    if (!entry) {
      this.sendToWebview({ type: "error", chatId, error: `モデルが見つかりません: ${modelId}` });
      return;
    }

    const chat = await chatStorage.loadChat(chatId);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      attachments,
    };
    chat.messages.push(userMessage);
    chat.provider = entry.provider;

    if (chat.messages.filter((m: Message) => m.role === "user").length === 1) {
      chat.title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
    }

    await chatStorage.saveChat(chat);

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const projectContext = settings.autoLoadProjectFiles !== false
      ? await loadProjectContext()
      : {};
    const activeFilePath = activeEditorTracker.getContext()?.filePath;

    const loadedFiles: string[] = [];
    if (projectContext.agentsMd) loadedFiles.push("AGENTS.md");
    if (projectContext.claudeMd) loadedFiles.push("CLAUDE.md");
    if (projectContext.geminiMd) loadedFiles.push("GEMINI.md");
    if (projectContext.readmeMd) loadedFiles.push("README.md");
    if (loadedFiles.length > 0) {
      this.sendToWebview({ type: "projectContextLoaded", files: loadedFiles });
    }

    const themeKind = vscode.window.activeColorTheme.kind;
    const vscodeTheme: "dark" | "light" =
      themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast
        ? "dark"
        : "light";

    const systemPrompt = buildSystemPromptParts({
      workspacePath,
      model: entry.model,
      activeFilePath,
      projectContext,
      userSystemPrompt: settings.systemPrompt,
      vscodeTheme,
    });

    const apiKey = await this.context.secrets.get(`hime.apiKey.${entry.provider}`);
    const providerConfig: ProviderConfig = {
      type: entry.provider,
      apiKey: apiKey || undefined,
      endpoint: entry.endpoint || undefined,
      deploymentName: entry.deploymentName || undefined,
      model: entry.model,
    };
    const provider = createProvider(providerConfig);

    const lastClearIdx = [...chat.messages].reverse().findIndex((m) => m.contextClearMark);
    const relevantMessages = lastClearIdx >= 0
      ? chat.messages.slice(chat.messages.length - lastClearIdx)
      : chat.messages;

    const messageId = crypto.randomUUID();
    currentAbortController = new AbortController();

    try {
      const assistantMessage: Message = {
        id: messageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        provider: entry.provider,
        model: entry.model,
        toolCalls: [],
      };

      outputChannel.appendLine(`\n${"=".repeat(60)}`);
      outputChannel.appendLine(`[${new Date().toISOString()}] REQUEST`);
      outputChannel.appendLine(JSON.stringify({
        provider: entry.provider,
        model: entry.model,
        systemPrompt,
        messages: relevantMessages,
        tools: toolExecutor.getToolsForProvider(entry.provider),
      }, null, 2));

      const finalAssistantMessage = await provider.chat(
        relevantMessages,
        systemPrompt,
        (token) => {
          assistantMessage.content += token;
          this.sendToWebview({ type: "token", chatId, messageId, content: token });
        },
        async (toolCall) => {
          try {
            const result = await toolExecutor.executeToolCall(toolCall);
            outputChannel.appendLine(`[Tool] ${toolCall.name} → ${result.length > 500 ? result.slice(0, 500) + "..." : result}`);
            const updatedTc = assistantMessage.toolCalls?.find((t) => t.id === toolCall.id);
            if (updatedTc) {
              updatedTc.status = "completed";
              updatedTc.result = result;
            }
            this.sendToWebview({
              type: "toolResult",
              chatId,
              messageId,
              toolCallId: toolCall.id,
              result,
            });
            return result;
          } catch (err: any) {
            const errorMsg = err.message || String(err);
            outputChannel.appendLine(`[Tool] ${toolCall.name} ERROR: ${errorMsg}`);
            const updatedTc = assistantMessage.toolCalls?.find((t) => t.id === toolCall.id);
            if (updatedTc) {
              updatedTc.status = "error";
              updatedTc.error = errorMsg;
            }
            this.sendToWebview({
              type: "toolResult",
              chatId,
              messageId,
              toolCallId: toolCall.id,
              result: errorMsg,
              isError: true,
            });
            throw err;
          }
        },
        (toolCall) => {
          outputChannel.appendLine(`[Tool] ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
          const tc: import("./types/chat").ToolCall = {
            id: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
            status: "running",
          };
          assistantMessage.toolCalls = [...(assistantMessage.toolCalls || []), tc];
          this.sendToWebview({ type: "toolCall", chatId, messageId, toolCall: tc });
        },
        currentAbortController.signal,
        toolExecutor.getToolsForProvider(entry.provider)
      );

      assistantMessage.content = finalAssistantMessage.content;
      assistantMessage.toolCalls = finalAssistantMessage.toolCalls;
      assistantMessage.usage = finalAssistantMessage.usage;

      if (finalAssistantMessage.usage) {
        const u = finalAssistantMessage.usage;
        const cacheTokens = (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0);
        const nonCachedInput = u.inputTokens - cacheTokens;
        outputChannel.appendLine(`[tokens] input: ${nonCachedInput} tok, cache: ${cacheTokens} tok, output: ${u.outputTokens} tok`);
      }

      if (!chat.messages.find((m: Message) => m.id === messageId)) {
        chat.messages.push(assistantMessage);
      } else {
        const idx = chat.messages.findIndex((m: Message) => m.id === messageId);
        chat.messages[idx] = assistantMessage;
      }

      chat.updatedAt = new Date().toISOString();
      await chatStorage.saveChat(chat);
      await this.sendChatList();

      this.sendToWebview({
        type: "streamEnd",
        chatId,
        messageId,
        fullContent: assistantMessage.content,
        toolCalls: assistantMessage.toolCalls,
      });
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("Provider chat error:", err);
      outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: provider.chat failed`);
      outputChannel.appendLine(`Message: ${err.message || String(err)}`);
      if (err.stack) outputChannel.appendLine(`Stack:\n${err.stack}`);
      if (err.cause) outputChannel.appendLine(`Cause: ${JSON.stringify(err.cause, null, 2)}`);
      
      this.sendToWebview({ type: "error", chatId, error: err.message || String(err) });
    } finally {
      currentAbortController = null;
    }
  }

  private async handleExecuteSkill(
    chatId: string,
    skillName: string,
    args: string,
    modelId: string
  ) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const skill = await findSkill(skillName, workspacePath);
    if (!skill) {
      this.sendToWebview({
        type: "error",
        chatId,
        error: `スキル "${skillName}" が見つかりませんでした。/skills で一覧を確認してください。`,
      });
      return;
    }

    const editor = vscode.window.activeTextEditor;
    const selection = editor ? editor.document.getText(editor.selection) : "";
    const activeFilePath = activeEditorTracker.getContext()?.filePath || "";

    const themeKind = vscode.window.activeColorTheme.kind;
    const vscodeTheme: "dark" | "light" =
      themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast
        ? "dark"
        : "light";

    const expandedPrompt = expandSkillPrompt(skill.prompt, {
      arguments: args,
      selection: selection || undefined,
      activeFile: activeFilePath || undefined,
      vscodeTheme,
    });

    this.sendToWebview({ type: "skillExecuted", chatId, skillName, expandedPrompt });

    await this.handleSendMessage(chatId, expandedPrompt, modelId);
  }

  private async handleListSkills() {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const skills = await loadAllSkills(workspacePath);
    const helpText = buildSkillsHelpText(skills);
    this.sendToWebview({ type: "skillsList", content: helpText });
  }

  private async handleListHelp() {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const skills = await loadAllSkills(workspacePath);
    const helpText = buildHelpText(skills);
    this.sendToWebview({ type: "helpContent", content: helpText });
  }

  private async handleCompressContext(chatId: string) {
    const chat = await chatStorage.loadChat(chatId);
    const settings = await settingsStorage.load();
    const entry = settings.models.find((m) => m.id === settings.defaultModelId);
    if (!entry) {
      this.sendToWebview({ type: "error", chatId, error: "デフォルトモデルが設定されていません" });
      return;
    }

    const apiKey = await this.context.secrets.get(`hime.apiKey.${entry.provider}`);
    const provider = createProvider({
      type: entry.provider,
      apiKey: apiKey || undefined,
      endpoint: entry.endpoint || undefined,
      deploymentName: entry.deploymentName || undefined,
      model: entry.model,
    });

    const summary = await provider.chat(
      [
        ...chat.messages,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: "これまでの会話を簡潔に要約してください。重要なポイントと決定事項を含めてください。",
          timestamp: new Date().toISOString(),
        },
      ],
      "あなたは会話の要約を行うアシスタントです。",
      () => {},
      undefined,
      undefined
    );

    chat.messages.push(
      {
        id: crypto.randomUUID(),
        role: "system",
        content: "コンテキストが圧縮されました",
        timestamp: new Date().toISOString(),
        contextClearMark: true,
      },
      {
        id: crypto.randomUUID(),
        role: "system",
        content: `【会話の要約】\n${summary.content}`,
        timestamp: new Date().toISOString(),
      }
    );
    chat.updatedAt = new Date().toISOString();
    await chatStorage.saveChat(chat);
    this.sendToWebview({ type: "chatLoaded", chat });
  }

  private async handleTestConnection(modelId: string) {
    outputChannel.appendLine(`\n${"=".repeat(60)}`);
    outputChannel.appendLine(`[${new Date().toISOString()}] CONNECTION TEST: ${modelId}`);
    try {
      const settings = await settingsStorage.load();
      const entry = settings.models.find((m) => m.id === modelId);
      if (!entry) throw new Error(`モデルが見つかりません: ${modelId}`);

      const apiKey = await this.context.secrets.get(`hime.apiKey.${entry.provider}`);
      const provider = createProvider({
        type: entry.provider,
        apiKey: apiKey || undefined,
        endpoint: entry.endpoint || undefined,
        deploymentName: entry.deploymentName || undefined,
        model: entry.model,
      });

      outputChannel.appendLine(`provider: ${entry.provider}`);
      outputChannel.appendLine(`model: ${entry.model}`);
      outputChannel.appendLine(`endpoint: ${entry.endpoint ?? "(default)"}`);

      await provider.testConnection();
      outputChannel.appendLine(`result: OK`);
      this.sendToWebview({ type: "connectionTestResult", modelId, success: true });
    } catch (err: any) {
      outputChannel.appendLine(`result: FAILED`);
      outputChannel.appendLine(`message: ${err.message || String(err)}`);
      if (err.status !== undefined) {
        outputChannel.appendLine(`status: ${err.status}`);
      }
      if (err.error) {
        outputChannel.appendLine(`body: ${JSON.stringify(err.error, null, 2)}`);
      }
      if (err.stack) {
        outputChannel.appendLine(`stack:\n${err.stack}`);
      }
      this.sendToWebview({
        type: "connectionTestResult",
        modelId,
        success: false,
        error: err.message || String(err),
      });
    }
  }

  private async handleReconnectMcp() {
    try {
      const settings = await settingsStorage.load();
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
      await mcpClient.connectAll(workspacePath, settings.mcpServers);
      this.sendMcpStatus();
      vscode.window.showInformationMessage("MCP サーバーに再接続しました。");
    } catch (err: any) {
      vscode.window.showErrorMessage(`MCP 接続エラー: ${err.message}`);
    }
  }

  sendMcpStatus() {
    const servers = mcpClient.getServerStatuses();
    this.sendToWebview({ type: "mcpStatus", servers });
  }

  private async sendChatList() {
    const chats = await chatStorage.listChats();
    this.sendToWebview({ type: "chatListUpdate", chats });
  }

  private async sendSettings() {
    const settings = await settingsStorage.load();
    const hasApiKeys: Record<ProviderType, boolean> = {
      anthropic: !!(await this.context.secrets.get("hime.apiKey.anthropic")),
      openai: !!(await this.context.secrets.get("hime.apiKey.openai")),
      "azure-openai": !!(await this.context.secrets.get("hime.apiKey.azure-openai")),
      "azure-openai-custom": !!(await this.context.secrets.get("hime.apiKey.azure-openai-custom")),
      ollama: true,
      openrouter: !!(await this.context.secrets.get("hime.apiKey.openrouter")),
      google: !!(await this.context.secrets.get("hime.apiKey.google")),
      xai: !!(await this.context.secrets.get("hime.apiKey.xai")),
      custom: !!(await this.context.secrets.get("hime.apiKey.custom")),
    };
    this.sendToWebview({ type: "settings", settings, hasApiKeys });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.css")
    );

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https:; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval' https:; img-src ${webview.cspSource} data: blob: https:; font-src https: data:; connect-src *;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Hime</title>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
