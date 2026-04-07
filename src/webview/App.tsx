import React, { useState, useEffect } from "react";
import { ChatView } from "./components/ChatView";
import { ChatList } from "./components/ChatList";
import { SettingsPanel } from "./components/SettingsPanel";
import { useChat } from "./hooks/useChat";
import { useSettings } from "./hooks/useSettings";
import { useVSCode } from "./hooks/useVSCode";
import { ProviderType } from "../types/chat";
import "highlight.js/styles/vs.css";
import "./styles/index.css";

export function App() {
  const chat = useChat();
  const settingsHook = useSettings();
  const { postMessage } = useVSCode();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("anthropic");

  useEffect(() => {
    if (settingsHook.settings?.defaultProvider) {
      setSelectedProvider(settingsHook.settings.defaultProvider);
    }
  }, [settingsHook.settings?.defaultProvider]);

  const handleProviderChange = (provider: ProviderType) => {
    setSelectedProvider(provider);
    settingsHook.updateSettings({ defaultProvider: provider });
  };

  const mcpStatus = settingsHook.mcpStatus;
  const mcpTotal = mcpStatus.length;
  const mcpConnected = mcpStatus.filter((s) => s.status === "connected").length;
  const mcpColor =
    mcpTotal === 0
      ? null
      : mcpConnected === mcpTotal
      ? "text-green-500"
      : mcpConnected === 0
      ? "text-red-500"
      : "text-yellow-600";

  const appFontClass = settingsHook.settings?.fontFamily === "sans-serif" ? "app-font-sans" : "app-font-serif";

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex justify-between items-center px-3 py-2.5 border-b border-vsc-border bg-vsc-bg-secondary">
        <div className="flex items-center gap-1.5">
          <h1 className="text-sm font-bold tracking-wide bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Hime
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {mcpTotal > 0 && mcpColor && (
            <span
              className={`text-xs font-mono px-1.5 py-0.5 rounded ${mcpColor}`}
              title={mcpStatus.map((s) => `${s.name}: ${s.status}`).join("\n")}
            >
              MCP ({mcpConnected}/{mcpTotal})
            </span>
          )}
          <button
            className="bg-transparent border-none text-vsc-fg cursor-pointer p-1 px-1.5 rounded hover:bg-vsc-bg-hover transition-colors"
            onClick={() => setShowSettings(!showSettings)}
            title="設定"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
              <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" fillRule="evenodd" transform="scale(0.95) translate(0.4, 0.4)" />
            </svg>
          </button>
          <button
            className="bg-transparent border-none text-vsc-fg cursor-pointer p-1 px-1.5 rounded hover:bg-vsc-bg-hover transition-colors"
            onClick={chat.createChat}
            title="新規チャット"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
          </button>
        </div>
      </header>

      {showSettings ? (
        <SettingsPanel
          settings={settingsHook.settings}
          hasApiKeys={settingsHook.hasApiKeys}
          connectionTestResult={settingsHook.connectionTestResult}
          onUpdateSettings={settingsHook.updateSettings}
          onSetApiKey={settingsHook.setApiKey}
          onDeleteApiKey={settingsHook.deleteApiKey}
          onTestConnection={settingsHook.testConnection}
          onReconnectMcp={settingsHook.reconnectMcp}
          onOpenSettingsJson={() => postMessage({ command: "openSettingsJson" })}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <>
          <ChatList
            chats={chat.chats}
            currentChatId={chat.currentChat?.id || null}
            onSelect={chat.loadChat}
            onDelete={chat.deleteChat}
          />

          <ChatView
            className={appFontClass}
            chat={chat.currentChat}
            isStreaming={chat.isStreaming}
            streamingContent={chat.streamingContent}
            streamingMessageId={chat.streamingMessageId}
            streamingToolCalls={chat.streamingToolCalls}
            error={chat.error}
            loadedContextFiles={chat.loadedContextFiles}
            skillsHelp={chat.skillsHelp}
            selectedProvider={selectedProvider}
            onSendMessage={(content) => chat.sendMessage(content, selectedProvider)}
            onProviderChange={handleProviderChange}
            onClearContext={chat.clearContext}
            onCompressContext={chat.compressContext}
            onAbortStream={chat.abortStream}
            onDismissSkillsHelp={chat.dismissSkillsHelp}
          />
        </>
      )}
    </div>
  );
}
