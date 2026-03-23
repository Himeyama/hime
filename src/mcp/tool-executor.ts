import { MCPClientManager } from "./client";
import { ToolCall } from "../types/chat";
import { MCPTool } from "../types/mcp";

export class ToolExecutor {
  constructor(private mcpClient: MCPClientManager) {}

  getToolDefinitions(): MCPTool[] {
    return this.mcpClient.listTools();
  }

  async executeToolCall(toolCall: ToolCall): Promise<string> {
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
        return this.toOpenAITools();
      default:
        return undefined;
    }
  }
}
