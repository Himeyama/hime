import * as vscode from "vscode";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPServerConfig, MCPConfig, MCPTool, MCPToolResult, MCPConnection } from "../types/mcp";
import * as fs from "fs/promises";
import * as path from "path";

export class MCPClientManager {
  private connections: Map<string, { client: Client; transport: StdioClientTransport; tools: MCPTool[] }> = new Map();
  private serverStatuses: Map<string, "connected" | "error"> = new Map();

  async loadConfig(workspacePath: string): Promise<MCPConfig | null> {
    try {
      const configPath = path.join(workspacePath, "mcp.json");
      const content = await fs.readFile(configPath, "utf-8");
      return JSON.parse(content) as MCPConfig;
    } catch {
      return null;
    }
  }

  async connectAll(workspacePath: string, mcpServers?: Record<string, MCPServerConfig>): Promise<void> {
    await this.disconnectAll();
    this.serverStatuses.clear();

    let servers = mcpServers;
    if (!servers) {
      const config = await this.loadConfig(workspacePath);
      if (config) {
        servers = config.mcpServers;
      }
    }

    if (!servers) return;

    for (const [name, serverConfig] of Object.entries(servers)) {
      try {
        await this.connect(name, serverConfig);
        this.serverStatuses.set(name, "connected");
      } catch (err) {
        console.error(`Failed to connect to MCP server "${name}":`, err);
        this.serverStatuses.set(name, "error");
      }
    }
  }

  async connect(name: string, serverConfig: MCPServerConfig): Promise<void> {
    const isWindows = process.platform === "win32";
    const command = isWindows && serverConfig.command === "npx" ? "npx.cmd" : serverConfig.command;

    const transport = new StdioClientTransport({
      command: command,
      args: serverConfig.args,
      env: {
        ...(process.env as Record<string, string>),
        ...(serverConfig.env as Record<string, string> | undefined),
      },
    });

    const client = new Client({ name: "hime", version: "0.1.0" }, { capabilities: {} });
    await client.connect(transport);

    // List available tools
    const toolsResult = await client.listTools();
    const tools: MCPTool[] = toolsResult.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));

    this.connections.set(name, { client, transport, tools });
  }

  getServerStatuses(): { name: string; status: "connected" | "error"; toolCount: number }[] {
    return Array.from(this.serverStatuses.entries()).map(([name, status]) => ({
      name,
      status,
      toolCount: status === "connected" ? (this.connections.get(name)?.tools.length ?? 0) : 0,
    }));
  }

  listConnections(): MCPConnection[] {
    const result: MCPConnection[] = [];
    for (const [name, conn] of this.connections) {
      result.push({
        id: name,
        name,
        status: "connected",
        tools: conn.tools,
      });
    }
    return result;
  }

  listTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const conn of this.connections.values()) {
      tools.push(...conn.tools);
    }
    return tools;
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    for (const conn of this.connections.values()) {
      const tool = conn.tools.find((t) => t.name === toolName);
      if (tool) {
        try {
          const result = await conn.client.callTool({ name: toolName, arguments: args });
          const content = Array.isArray(result.content)
            ? result.content.map((c: any) => c.text || JSON.stringify(c)).join("\n")
            : String(result.content);
          return { content, isError: !!result.isError };
        } catch (err: any) {
          return { content: err.message || String(err), isError: true };
        }
      }
    }
    return { content: `Tool "${toolName}" not found`, isError: true };
  }

  async disconnect(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (conn) {
      await conn.client.close();
      this.connections.delete(name);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const name of this.connections.keys()) {
      await this.disconnect(name);
    }
  }
}
