import * as vscode from "vscode";
import { MCPClientManager } from "./client";
import { ToolCall } from "../types/chat";
import { MCPTool } from "../types/mcp";
import { BUILTIN_TOOL_NAMES, getBuiltinToolDefinitions, executeBuiltinTool } from "../context/built-in-tools";

export class ToolExecutor {
  constructor(private mcpClient: MCPClientManager) {}

  getToolDefinitions(): MCPTool[] {
    return [...getBuiltinToolDefinitions(), ...this.mcpClient.listTools()];
  }

  getToolTitle(name: string): string | undefined {
    return this.getToolDefinitions().find((t) => t.name === name)?.title;
  }

  getDisplayTitle(name: string, args: Record<string, unknown>): string | undefined {
    const str = (v: unknown) => (v != null ? String(v) : undefined);
    switch (name) {
      case "Read":
      case "Write":
      case "Edit":
        return str(args.file_path) ?? this.getToolTitle(name);
      case "Glob":
      case "Grep":
        return str(args.pattern) ?? this.getToolTitle(name);
      case "WebSearch":
        return str(args.query) ?? this.getToolTitle(name);
      case "WebFetch":
        return str(args.url) ?? this.getToolTitle(name);
      case "PowerShell":
      case "Bash":
        return str(args.description) ?? this.getToolTitle(name);
      default:
        return this.getToolTitle(name);
    }
  }

  async executeToolCall(toolCall: ToolCall): Promise<string> {
    if (BUILTIN_TOOL_NAMES.has(toolCall.name)) {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
      return executeBuiltinTool(toolCall.name, toolCall.arguments, workspacePath);
    }
    const result = await this.mcpClient.executeTool(toolCall.name, toolCall.arguments);
    if (result.isError) {
      throw new Error(result.content);
    }
    return result.content;
  }

  // Convert MCP tools to Anthropic tool format
  toAnthropicTools(): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
    return this.getToolDefinitions().map((tool) => ({
      name: tool.name,
      description: tool.description || "",
      input_schema: tool.inputSchema,
    }));
  }

  // Convert MCP tools to OpenAI tool format
  toOpenAITools(): Array<{ type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return this.getToolDefinitions().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.inputSchema,
      },
    }));
  }

  getToolsForProvider(providerType: string): any[] | undefined {
    const tools = this.getToolDefinitions();
    if (tools.length === 0) return undefined;

    switch (providerType) {
      case "anthropic":
        return this.toAnthropicTools();
      case "openai":
      case "azure-openai":
      case "openrouter":
      case "ollama":
      case "google":
      case "custom":
        return this.toOpenAITools();
      default:
        return undefined;
    }
  }
}
