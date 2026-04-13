import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Paperclip } from "lucide-react";
import { Message, ToolCall } from "../../types/chat";
import { CodeBlock } from "./CodeBlock";
import { ToolCallView } from "./ToolCallView";
import { ImagePreview } from "./ImagePreview";
import { cn } from "../lib/utils";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
  streamingToolCalls?: ToolCall[];
}

export function MessageBubble({ message, isStreaming, streamingContent, streamingToolCalls }: MessageBubbleProps) {
  const content = streamingContent || message.content;
  const isUser = message.role === "user";

  if (message.contextClearMark) {
    return null;
  }

  return (
    <div className={cn("flex flex-col animate-fade-in", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "text-[13px] leading-relaxed relative",
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[90%] shadow-sm"
            : "w-full py-1.5"
        )}
      >
        {(streamingToolCalls || message.toolCalls)?.map((tc) => (
          <ToolCallView key={tc.id} toolCall={tc} />
        ))}

        {isUser ? (
          <div className="whitespace-pre-wrap break-words">
            {content}
          </div>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a({ children, href, ...props }) {
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                      {children}
                    </a>
                  );
                },
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeStr = String(children).replace(/\n$/, "");
                  if (match) {
                    return <CodeBlock language={match[1]} code={codeStr} />;
                  }
                  return (
                    <code className="inline-code" {...props}>
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
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
        )}

        {message.attachments?.map((att, i) =>
          att.type === "image" ? (
            <ImagePreview key={i} attachment={att} />
          ) : (
            <div key={i} className="inline-flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md text-xs my-1 border border-border">
              <Paperclip className="h-3 w-3 shrink-0" />
              {att.name}
            </div>
          )
        )}

        {isStreaming && (
          <span className="animate-blink text-primary-foreground ml-0.5">▊</span>
        )}

        {message.provider && !isUser && (
          <div className="text-[10px] text-muted-foreground/50 mt-2 text-right select-none">
            {message.provider}{message.model ? ` · ${message.model}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
