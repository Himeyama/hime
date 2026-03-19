import React, { useEffect, useRef, useMemo } from "react";
import { Message, ToolCall } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  streamingToolCalls?: ToolCall[];
}

export function MessageList({
  messages,
  isStreaming,
  streamingContent,
  streamingMessageId,
  streamingToolCalls,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only show messages after the last context clear mark
  const visibleMessages = useMemo(() => {
    const lastClearIdx = messages.reduce(
      (idx, msg, i) => (msg.contextClearMark ? i : idx),
      -1
    );
    if (lastClearIdx < 0) return messages;
    return messages.slice(lastClearIdx + 1);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-thin scroll-smooth">
      {visibleMessages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isStreaming={isStreaming && msg.id === streamingMessageId}
          streamingContent={msg.id === streamingMessageId ? streamingContent : undefined}
          streamingToolCalls={msg.id === streamingMessageId ? streamingToolCalls : undefined}
        />
      ))}
      {isStreaming && streamingMessageId && !visibleMessages.some((m) => m.id === streamingMessageId) && (
        <MessageBubble
          message={{
            id: streamingMessageId,
            role: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
          }}
          isStreaming={true}
          streamingContent={streamingContent}
          streamingToolCalls={streamingToolCalls}
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
