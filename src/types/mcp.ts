export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
  content: string;
  isError: boolean;
}

export interface MCPConnection {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  tools: MCPTool[];
}
