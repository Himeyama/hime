import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Paperclip, ChevronRight, ChevronDown, Wrench } from "lucide-react";
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
  const [isSkillExpanded, setIsSkillExpanded] = useState(false);

  if (message.contextClearMark) {
    return null;
  }

  return (
    <div className={cn("flex flex-col animate-fade-in last:border-0", isUser ? "items-end bg-muted/5 py-4 px-4" : "items-start")}>
      <div className={cn(
        "max-w-full w-full flex flex-col",
        isUser ? "items-end px-0" : "px-4 py-4"
      )}>
        {(streamingToolCalls || message.toolCalls)?.map((tc) => (
          <div key={tc.id} className="w-full">
            <ToolCallView toolCall={tc} />
          </div>
        ))}

        <div className={cn(
          "text-vsc leading-relaxed",
          isUser 
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm whitespace-pre-wrap break-words max-w-[90%]" 
            : "markdown-body relative group"
        )}>
          {isUser ? (
            message.skill ? (
              <div className="flex flex-col">
                <div 
                  className="flex items-center gap-2 cursor-pointer font-medium select-none"
                  onClick={() => setIsSkillExpanded(!isSkillExpanded)}
                >
                  <Wrench className="w-4 h-4 opacity-70" />
                  <span>Skill: {message.skill.name}</span>
                  {isSkillExpanded ? (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  ) : (
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  )}
                </div>
                {isSkillExpanded && (
                  <div className="mt-2 text-sm opacity-90 border-t border-primary-foreground/20 pt-2 break-all">
                    {content}
                  </div>
                )}
              </div>
            ) : (
              content
            )
          ) : (
            <>
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
              
              {!isUser && message.provider && (
                <div className="flex justify-end mt-2 select-none">
                  <span className="text-[10px] text-muted-foreground/30 font-mono italic group-hover:text-muted-foreground/60 transition-colors">
                    {message.provider}{message.model ? ` · ${message.model}` : ""}
                  </span>
                </div>
              )}
            </>
          )}

          {isStreaming && !isUser && (
            <span className="animate-blink text-primary ml-1 text-xs">▊</span>
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className={cn("flex flex-wrap gap-2 mt-2 w-full", isUser ? "justify-end" : "justify-start")}>
            {message.attachments.map((att, i) =>
              att.type === "image" ? (
                <ImagePreview key={i} attachment={att} />
              ) : (
                <div key={i} className="inline-flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded border border-border/50 text-[10px] select-none">
                  <Paperclip className="h-3 w-3 shrink-0 opacity-50" />
                  {att.name}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
