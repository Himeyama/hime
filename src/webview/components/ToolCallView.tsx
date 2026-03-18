import React, { useState } from "react";
import { ToolCall } from "../../types/chat";

interface ToolCallViewProps {
  toolCall: ToolCall;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--vscode-testing-iconPassed)" className="flex-shrink-0">
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25z" />
        </svg>
      );
    case "error":
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--vscode-errorForeground)" className="flex-shrink-0">
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
        </svg>
      );
    case "running":
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 animate-pulse-subtle">
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
        </svg>
      );
    default:
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 opacity-50">
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM5.5 6a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 5.5 6zm5.75.75a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 1.5 0v-3z" />
        </svg>
      );
  }
}

export function ToolCallView({ toolCall }: ToolCallViewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-vsc-border/50 rounded-lg my-2.5 p-2.5 text-xs bg-vsc-bg-hover/30 animate-fade-in">
      <div className="flex items-center gap-2 font-semibold">
        <span className="w-5 h-5 rounded-full bg-vsc-accent/20 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 0L0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617 2.675 2.675A1 1 0 0 1 11.5 13h.07a1 1 0 0 0 .815-.419L14.5 9.5 13 8l-1.585 1.585-.672-.672L12.5 7 11 5.5 9.272 7.228l-.672-.672L10.185 5 8.5 3.5l-3.081 2.2A1 1 0 0 0 5 6v-.07a1 1 0 0 1 .293-.708l2.675-2.675L5.851 0H1z" transform="scale(0.9) translate(1, 1)" />
          </svg>
        </span>
        <span className="text-vsc-fg">{toolCall.name}</span>
        <span className="ml-auto">
          <StatusIcon status={toolCall.status} />
        </span>
      </div>
      <div className="mt-1.5 pl-7 space-y-0.5">
        {Object.entries(toolCall.arguments).map(([key, value]) => (
          <div key={key} className="text-[11px]">
            <span className="text-vsc-fg-secondary">{key}:</span>{" "}
            <span className="text-vsc-fg">{String(value)}</span>
          </div>
        ))}
      </div>
      {(toolCall.result || toolCall.error) && (
        <div className="mt-2 pl-7">
          <button
            className="bg-transparent border border-vsc-border/50 text-vsc-fg cursor-pointer px-2 py-0.5 rounded-md text-[11px] hover:bg-vsc-bg-hover transition-colors flex items-center gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
            {expanded ? "結果を隠す" : "結果を表示"}
          </button>
          {expanded && (
            <pre className="mt-1.5 p-2.5 bg-black/10 rounded-md text-[11px] overflow-x-auto max-h-[200px] overflow-y-auto scrollbar-thin animate-slide-down">
              {toolCall.error || toolCall.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
