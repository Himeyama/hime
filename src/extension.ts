import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import * as os from "os";
import { ChatHistoryStorage } from "./storage/chat-history";
import { SettingsStorage } from "./storage/settings";
import { MCPClientManager } from "./mcp/client";
import { ToolExecutor } from "./mcp/tool-executor";
import { createProvider } from "./providers/index";
import { ActiveEditorTracker } from "./context/active-editor";
import { loadProjectContext } from "./context/workspace-files";
import { buildSystemPrompt } from "./context/system-prompt";
import { ProviderType, Message } from "./types/chat";
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

  // Initialize storage
  chatStorage = new ChatHistoryStorage();
  settingsStorage = new SettingsStorage();
  await chatStorage.initialize();
  await settingsStorage.initialize();

  // Initialize MCP
  mcpClient = new MCPClientManager();
  toolExecutor = new ToolExecutor(mcpClient);

  // Register webview provider
  const provider = new HimeChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("hime.chatView", provider)
  );

  // Connect MCP servers and notify webview when done
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

  // Register commands
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

  // Active editor tracking
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
          const chat = await chatStorage.createChat(settings.defaultProvider);
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
          await chatStorage.deleteChat(message.chatId);
          await this.sendChatList();
          break;
        }
        case "sendMessage": {
          await this.handleSendMessage(message.chatId, message.content, message.provider, message.attachments);
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
        case "setProvider": {
          const settings = await settingsStorage.load();
          settings.defaultProvider = message.provider;
          await settingsStorage.save(settings);
          break;
        }
        case "listModels": {
          await this.handleListModels(message.provider);
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
        case "setApiKey": {
          await this.context.secrets.store(`hime.apiKey.${message.provider}`, message.apiKey);
          await this.sendSettings();
          break;
        }
        case "deleteApiKey": {
          await this.context.secrets.delete(`hime.apiKey.${message.provider}`);
          await this.sendSettings();
          break;
        }
        case "testConnection": {
          await this.handleTestConnection(message.provider);
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
        case "addReaction": {
          const chat = await chatStorage.loadChat(message.chatId);
          const msg = chat.messages.find((m) => m.id === message.messageId);
          if (msg) {
            const reactions = msg.reactions || [];
            const existing = reactions.findIndex((r) => r.type === message.reaction);
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
    providerType: ProviderType,
    attachments?: import("./types/chat").Attachment[]
  ) {
    const chat = await chatStorage.loadChat(chatId);

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      attachments,
    };
    chat.messages.push(userMessage);
    chat.provider = providerType;

    // Auto-title on first message
    if (chat.messages.filter((m) => m.role === "user").length === 1) {
      chat.title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
    }

    await chatStorage.saveChat(chat);

    // Build system prompt
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const projectContext = await loadProjectContext();
    const activeFile = activeEditorTracker.getContext();

    // Notify webview about loaded project context files
    const loadedFiles: string[] = [];
    if (projectContext.claudeMd) loadedFiles.push("CLAUDE.md");
    if (projectContext.agentsMd) loadedFiles.push("AGENTS.md");
    if (projectContext.readmeMd) loadedFiles.push("README.md");
    if (loadedFiles.length > 0) {
      this.sendToWebview({ type: "projectContextLoaded", files: loadedFiles });
    }
    const settings = await settingsStorage.load();
    const systemPrompt = buildSystemPrompt({
      workspacePath,
      activeFile,
      projectContext,
      userSystemPrompt: settings.systemPrompt,
    });

    // Create provider
    const apiKey = await this.context.secrets.get(`hime.apiKey.${providerType}`);
    const providerSettings = settings.providers[providerType];
    const providerConfig: ProviderConfig = {
      type: providerType,
      apiKey: apiKey || undefined,
      endpoint: providerSettings?.endpoint || undefined,
      deploymentName: providerSettings?.deploymentName || undefined,
      model: providerSettings?.model || "default",
    };
    const provider = createProvider(providerConfig);

    // Get messages after last context clear
    const lastClearIdx = [...chat.messages].reverse().findIndex((m) => m.contextClearMark);
    const relevantMessages = lastClearIdx >= 0
      ? chat.messages.slice(chat.messages.length - lastClearIdx)
      : chat.messages;

    const messageId = crypto.randomUUID();
    currentAbortController = new AbortController();

    try {
      // MCP tools
      const mcpTools = toolExecutor.getToolDefinitions();
      let hasTools = mcpTools.length > 0;

      const assistantMessage: Message = {
        id: messageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        provider: providerType,
        model: providerConfig.model,
        toolCalls: [],
      };

      outputChannel.appendLine(`\n${"=".repeat(60)}`);
      outputChannel.appendLine(`[${new Date().toISOString()}] REQUEST`);
      outputChannel.appendLine(JSON.stringify({
        provider: providerType,
        model: providerConfig.model,
        systemPrompt,
        messages: relevantMessages,
        tools: toolExecutor.getToolsForProvider(providerType),
      }, null, 2));

      const finalAssistantMessage = await provider.chat(
        relevantMessages,
        systemPrompt,
        (token) => {
          assistantMessage.content += token;
          this.sendToWebview({ type: "token", chatId, messageId, content: token });
        },
        async (toolCall) => {
          const tc: import("./types/chat").ToolCall = {
            id: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
            status: "running",
          };
          assistantMessage.toolCalls = [...(assistantMessage.toolCalls || []), tc];
          this.sendToWebview({ type: "toolCall", chatId, messageId, toolCall: tc });

          try {
            const result = await toolExecutor.executeToolCall(toolCall);
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
        currentAbortController.signal,
        toolExecutor.getToolsForProvider(providerType)
      );

      assistantMessage.content = finalAssistantMessage.content;
      assistantMessage.toolCalls = finalAssistantMessage.toolCalls;
      
      if (!chat.messages.find(m => m.id === messageId)) {
        chat.messages.push(assistantMessage);
      } else {
        const idx = chat.messages.findIndex(m => m.id === messageId);
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
      this.sendToWebview({ type: "error", chatId, error: err.message || String(err) });
    } finally {
      currentAbortController = null;
    }
  }

  private async handleCompressContext(chatId: string) {
    const chat = await chatStorage.loadChat(chatId);
    const settings = await settingsStorage.load();
    const apiKey = await this.context.secrets.get(`hime.apiKey.${chat.provider}`);
    const providerSettings = settings.providers[chat.provider];

    const provider = createProvider({
      type: chat.provider,
      apiKey: apiKey || undefined,
      endpoint: providerSettings?.endpoint || undefined,
      model: providerSettings?.model || "default",
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

    // Add context clear and summary
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

  private async handleListModels(providerType: ProviderType) {
    try {
      const settings = await settingsStorage.load();
      const apiKey = await this.context.secrets.get(`hime.apiKey.${providerType}`);
      const providerSettings = settings.providers[providerType];

      const provider = createProvider({
        type: providerType,
        apiKey: apiKey || undefined,
        endpoint: providerSettings?.endpoint || undefined,
        model: providerSettings?.model || "default",
      });

      const models = await provider.listModels();
      this.sendToWebview({ type: "modelList", provider: providerType, models });
    } catch (err: any) {
      console.error("Failed to list models:", err);
    }
  }

  private async handleTestConnection(providerType: ProviderType) {
    try {
      const settings = await settingsStorage.load();
      const apiKey = await this.context.secrets.get(`hime.apiKey.${providerType}`);
      const providerSettings = settings.providers[providerType];

      const provider = createProvider({
        type: providerType,
        apiKey: apiKey || undefined,
        endpoint: providerSettings?.endpoint || undefined,
        model: providerSettings?.model || "default",
      });

      const success = await provider.testConnection();
      this.sendToWebview({ type: "connectionTestResult", provider: providerType, success });
    } catch (err: any) {
      this.sendToWebview({
        type: "connectionTestResult",
        provider: providerType,
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
      ollama: true,
      openrouter: !!(await this.context.secrets.get("hime.apiKey.openrouter")),
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
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Hime</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
