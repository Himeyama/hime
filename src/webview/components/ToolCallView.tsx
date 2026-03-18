import React, { useState } from "react";
import { ToolCall } from "../../types/chat";

interface ToolCallViewProps {
  toolCall: ToolCall;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <div className="w-1.5 h-1.5 rounded-full bg-vsc-success" />;
    case "error":
      return <div className="w-1.5 h-1.5 rounded-full bg-vsc-danger" />;
    case "running":
      return <div className="w-1.5 h-1.5 rounded-full bg-vsc-accent animate-pulse" />;
    default:
      return <div className="w-1.5 h-1.5 rounded-full bg-vsc-fg-secondary/30" />;
  }
}


export function ToolCallView({ toolCall }: ToolCallViewProps) {
  const isError = toolCall.status === "error";
  const result = toolCall.error || toolCall.result;

  return (
    <div className="my-3 animate-fade-in border-l-2 border-vsc-border/30 pl-3">
      <div className="flex items-center gap-2 mb-1.5">
        <StatusIcon status={toolCall.status} />
        <span className="text-[11px] font-bold text-vsc-fg-secondary uppercase tracking-wider">
          {toolCall.name}
        </span>
      </div>
      
      {result && (
        <div className={`text-[12px] p-2.5 rounded-lg border bg-vsc-bg-secondary/20 font-vsc-editor whitespace-pre-wrap overflow-x-auto max-h-[300px] scrollbar-thin ${
          isError ? "border-vsc-danger/20 text-vsc-danger/80" : "border-vsc-border/20 text-vsc-fg/80"
        }`}>
          {result}
        </div>
      )}
    </div>
  );
}
