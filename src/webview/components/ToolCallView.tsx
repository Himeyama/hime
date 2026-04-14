import React, { useState } from "react";
import { ToolCall } from "../../types/chat";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface ToolCallViewProps {
  toolCall: ToolCall;
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full shrink-0",
        status === "completed" && "bg-success",
        status === "error" && "bg-destructive",
        status === "running" && "bg-primary animate-blink",
        status !== "completed" && status !== "error" && status !== "running" && "bg-muted-foreground/30"
      )}
    />
  );
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
    <div className="my-3 animate-fade-in border-l-2 border-border/30 pl-3">
      <div className="flex flex-col gap-1 mb-1.5">
        <div className="flex items-center gap-2">
          <StatusDot status={toolCall.status} />
          <span className="text-[11px] font-vsc font-bold text-muted-foreground uppercase tracking-wider select-none">
            {toolCall.name}
          </span>
          {hasArgs && isLongArgs && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[10px] text-primary ml-auto"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "閉じる" : "引数を表示"}
            </Button>
          )}
        </div>

        {hasArgs && (
          <div
            className={cn(
              "text-[11px] text-foreground/70 font-vsc-editor pl-3.5 py-1 bg-muted/10 rounded-sm",
              isExpanded ? "whitespace-pre-wrap overflow-auto max-h-[200px]" : "truncate"
            )}
            title={!isExpanded ? argsJson : undefined}
          >
            {isExpanded ? argsJson : JSON.stringify(toolCall.arguments)}
          </div>
        )}
      </div>

      {(result || isRunning) && (
        <div
          className={cn(
            "text-[12px] p-2.5 rounded-lg border font-vsc-editor whitespace-pre-wrap overflow-auto max-h-[300px] scrollbar-thin select-none",
            isError
              ? "border-destructive/20 text-destructive/80 bg-card/20"
              : "border-border/20 text-foreground/80 bg-card/20",
            isRunning && "animate-pulse-subtle italic text-muted-foreground/60"
          )}
        >
          {isRunning ? "実行中..." : result}
        </div>
      )}
    </div>
  );
}
