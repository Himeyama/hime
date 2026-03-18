import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "../../types/chat";
import { CodeBlock } from "./CodeBlock";
import { ToolCallView } from "./ToolCallView";
import { ImagePreview } from "./ImagePreview";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
}

export function MessageBubble({ message, isStreaming, streamingContent }: MessageBubbleProps) {
  const content = streamingContent || message.content;
  const isUser = message.role === "user";

  if (message.contextClearMark) {
    return null;
  }

  return (
    <div className={`flex flex-col animate-fade-in ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`text-[13px] leading-relaxed relative ${
          isUser
            ? "bg-vsc-accent text-vsc-accent-fg rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[90%] shadow-sm"
            : "w-full py-1.5"
        }`}
      >
        <div className={`markdown-body ${isUser ? "text-vsc-accent-fg" : ""}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeStr = String(children).replace(/\n$/, "");
                // Check if it's a block-level code (inside pre)
                if (match) {
                  return <CodeBlock language={match[1]} code={codeStr} />;
                }
                // Inline code
                return (
                  <code className="inline-code" {...props}>
                    {children}
                  </code>
                );
              },
              pre({ children }) {
                // If children is already a CodeBlock (from code component), render directly
                const child = React.Children.toArray(children)[0];
                if (React.isValidElement(child) && child.type === CodeBlock) {
                  return <>{children}</>;
                }
                return <pre>{children}</pre>;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {message.attachments?.map((att, i) =>
          att.type === "image" ? (
            <ImagePreview key={i} attachment={att} />
          ) : (
            <div key={i} className="inline-flex items-center gap-1.5 bg-vsc-bg-hover/80 px-2.5 py-1 rounded-md text-xs my-1 border border-vsc-border/30">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M14 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6.5L14 4.5z" />
              </svg>
              {att.name}
            </div>
          )
        )}

        {message.toolCalls?.map((tc) => (
          <ToolCallView key={tc.id} toolCall={tc} />
        ))}

        {isStreaming && <span className="animate-blink text-vsc-accent ml-0.5">▊</span>}

        {message.provider && !isUser && (
          <div className="text-[10px] text-vsc-fg-secondary/50 mt-2 text-right select-none">
            {message.provider}{message.model ? ` · ${message.model}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
