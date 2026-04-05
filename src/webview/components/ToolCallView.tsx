import React, { useState } from "react";
import { ToolCall } from "../../types/chat";

interface ToolCallViewProps {
  toolCall: ToolCall;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <div className="w-1.5 h-1.5 rounded-full bg-vsc-success shadow-[0_0_4px_rgba(var(--vscode-testing-iconPassed),0.4)]" />;
    case "error":
      return <div className="w-1.5 h-1.5 rounded-full bg-vsc-danger shadow-[0_0_4px_rgba(var(--vscode-errorForeground),0.4)]" />;
    case "running":
      return <div className="w-1.5 h-1.5 rounded-full bg-vsc-accent animate-blink shadow-[0_0_6px_var(--vscode-button-background)]" />;
    default:
      return <div className="w-1.5 h-1.5 rounded-full bg-vsc-fg-secondary/30" />;
  }
}


export function ToolCallView({ toolCall }: ToolCallViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isRunning = toolCall.status === "running";
  const isError = toolCall.status === "error";
  const result = toolCall.error || toolCall.result;
  const hasArgs = Object.keys(toolCall.arguments).length > 0;
  const argsJson = JSON.stringify(toolCall.arguments, null, 2);
  const isLongArgs = argsJson.length > 100 || argsJson.includes("\n");

  return (
    <div className="my-3 animate-fade-in border-l-2 border-vsc-border/30 pl-3">
      <div className="flex flex-col gap-1 mb-1.5">
        <div className="flex items-center gap-2">
          <StatusIcon status={toolCall.status} />
          <span className="text-[11px] font-vsc font-bold text-vsc-fg-secondary uppercase tracking-wider">
            {toolCall.name}
          </span>
          {hasArgs && isLongArgs && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] text-vsc-accent hover:underline bg-transparent border-none p-0 cursor-pointer ml-auto"
            >
              {isExpanded ? "閉じる" : "引数を表示"}
            </button>
          )}
        </div>
        
        {hasArgs && (
          <div 
            className={`text-[11px] text-vsc-fg/70 font-vsc-editor pl-3.5 py-1 bg-vsc-bg-secondary/10 rounded-sm ${
              isExpanded ? "whitespace-pre-wrap overflow-auto max-h-[200px]" : "truncate"
            }`}
            title={!isExpanded ? argsJson : undefined}
          >
            {isExpanded ? argsJson : JSON.stringify(toolCall.arguments)}
          </div>
        )}
      </div>
      
      {(result || isRunning) && (
        <div className={`text-[12px] p-2.5 rounded-lg border bg-vsc-bg-secondary/20 font-vsc-editor whitespace-pre-wrap overflow-auto max-h-[300px] scrollbar-thin ${
          isError ? "border-vsc-danger/20 text-vsc-danger/80" : "border-vsc-border/20 text-vsc-fg/80"
        } ${isRunning ? "animate-pulse-subtle italic text-vsc-fg-secondary/60" : ""}`}>
          {isRunning ? "実行中..." : result}
        </div>
      )}
    </div>
  );
}
