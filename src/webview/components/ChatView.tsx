import React from "react";
import { Chat, ProviderType, ToolCall } from "../../types/chat";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { ProviderSelect } from "./ProviderSelect";

interface ChatViewProps {
  chat: Chat | null;
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  streamingToolCalls?: ToolCall[];
  error: string | null;
  loadedContextFiles: string[] | null;
  selectedProvider: ProviderType;
  onSendMessage: (content: string) => void;
  onProviderChange: (provider: ProviderType) => void;
  onClearContext: () => void;
  onCompressContext: () => void;
  onAbortStream: () => void;
}

export function ChatView({
  chat,
  isStreaming,
  streamingContent,
  streamingMessageId,
  streamingToolCalls,
  error,
  loadedContextFiles,
  selectedProvider,
  onSendMessage,
  onProviderChange,
  onClearContext,
  onCompressContext,
  onAbortStream,
}: ChatViewProps) {
  if (!chat) {
    return (
      <div className="flex items-center justify-center flex-1 text-vsc-fg-secondary px-6">
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-3 opacity-20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 36V12a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H14l-8 6z" />
            <circle cx="16" cy="21" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="24" cy="21" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="32" cy="21" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <p className="text-sm">チャットを選択するか、新規チャットを作成してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ツールバー */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-vsc-border/50">
        <ProviderSelect selected={selectedProvider} onChange={onProviderChange} />
        <div className="flex-1" />
        <button
          className="bg-transparent border border-vsc-border text-vsc-fg cursor-pointer px-2.5 py-0.5 rounded-md text-xs hover:bg-vsc-bg-hover transition-colors"
          onClick={onClearContext}
          title="コンテキストクリア"
        >
          クリア
        </button>
        <button
          className="bg-transparent border border-vsc-border text-vsc-fg cursor-pointer px-2.5 py-0.5 rounded-md text-xs hover:bg-vsc-bg-hover transition-colors"
          onClick={onCompressContext}
          title="コンテキスト圧縮"
        >
          圧縮
        </button>
      </div>

      {/* ドキュメント読み込み通知 */}
      {loadedContextFiles && loadedContextFiles.length > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-vsc-fg-secondary border-b border-vsc-border/30 bg-vsc-bg-hover/30 animate-fade-in text-center">
          {loadedContextFiles.join(", ")} を読み込みました
        </div>
      )}

      <MessageList
        messages={chat.messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        streamingMessageId={streamingMessageId}
        streamingToolCalls={streamingToolCalls}
      />

      {error && (
        <div className="bg-red-500/10 text-vsc-danger px-3 py-2 text-xs border-t border-vsc-danger/30 animate-fade-in flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
          </svg>
          {error}
        </div>
      )}

      {/* 入力エリア */}
      <div className="border-t border-vsc-border/40 px-4 py-4 bg-vsc-bg/80 backdrop-blur-md sticky bottom-0 z-10">
        <div className="max-w-4xl mx-auto">
          <InputArea
            onSend={onSendMessage}
            disabled={isStreaming}
            onAbort={onAbortStream}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
