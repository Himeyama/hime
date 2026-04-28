import * as vscode from "vscode";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { MCPServerConfig, MCPConfig, MCPTool, MCPToolResult, MCPConnection } from "../types/mcp";
import * as fs from "fs/promises";
import * as path from "path";

export class MCPClientManager {
  private connections: Map<string, { client: Client; transport: StdioClientTransport | SSEClientTransport; tools: MCPTool[] }> = new Map();
  private serverStatuses: Map<string, "connected" | "error" | "disabled"> = new Map();
  private outputChannel?: vscode.OutputChannel;

  constructor(outputChannel?: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  private log(message: string) {
    if (this.outputChannel) {
      this.outputChannel.appendLine(`[MCP] ${message}`);
    } else {
      console.log(`[MCP] ${message}`);
    }
  }

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
    this.log("Connecting to all MCP servers...");
    await this.disconnectAll();
    this.serverStatuses.clear();

    let servers = mcpServers;
    // Load from mcp.json if mcpServers is not provided or is an empty object
    if (!servers || Object.keys(servers).length === 0) {
      const config = await this.loadConfig(workspacePath);
      if (config) {
        servers = config.mcpServers;
      }
    }

    if (!servers) {
      this.log("No MCP servers configured.");
      return;
    }

    // Handle cases where the config might be nested under "mcpServers"
    // (e.g. when someone copy-pastes a full mcp.json into settings)
    if (servers.mcpServers && typeof servers.mcpServers === "object" && !servers.mcpServers.command && !servers.mcpServers.url) {
      this.log("Detected nested 'mcpServers' configuration, unwrapping...");
      servers = servers.mcpServers as Record<string, MCPServerConfig>;
    }

    for (const [name, serverConfig] of Object.entries(servers)) {
      if (serverConfig.disabled) {
        this.log(`Skipping MCP server "${name}" because it is disabled.`);
        this.serverStatuses.set(name, "disabled");
        continue;
      }
      try {
        await this.connect(name, serverConfig);
        this.serverStatuses.set(name, "connected");
      } catch (err: any) {
        this.log(`Failed to connect to MCP server "${name}": ${err.message || err}`);
        this.serverStatuses.set(name, "error");
      }
    }
  }

  async connect(name: string, serverConfig: MCPServerConfig): Promise<void> {
    let transport: StdioClientTransport | SSEClientTransport;

    if (serverConfig.url) {
      const sseUrl = new URL(serverConfig.url);
      this.log(`Connecting to "${name}" via SSE: ${sseUrl.toString()}`);
      
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "mcp-protocol-version": "2024-11-05",
      };

      transport = new SSEClientTransport(sseUrl, {
        requestInit: {
          headers: headers,
        },
        eventSourceInit: {
          headers: headers,
        } as any,
      });
    } else if (serverConfig.command) {
      const args = serverConfig.args || [];
      this.log(`Connecting to "${name}" via stdio: ${serverConfig.command} ${args.join(" ")}`);
      const isWindows = process.platform === "win32";
      const command = isWindows && serverConfig.command === "npx" ? "npx.cmd" : serverConfig.command;

      transport = new StdioClientTransport({
        command: command,
        args: args,
        env: {
          ...(process.env as Record<string, string>),
          ...(serverConfig.env as Record<string, string> | undefined),
        },
      });
    } else {
      throw new Error(`Invalid MCP server configuration for "${name}": neither "command" nor "url" provided.`);
    }

    const client = new Client({ name: "hime", version: "0.1.0" }, { capabilities: {} });

    try {
      await client.connect(transport);
    } catch (err: any) {
      this.log(`Connection error for "${name}": ${err.message || err}`);
      if (err.stack) {
        this.log(`Stack trace: ${err.stack}`);
      }
      throw err;
    }

    // List available tools
    const toolsResult = await client.listTools();
    const tools: MCPTool[] = toolsResult.tools.map((t) => ({
      name: t.name,
      title: t.annotations?.title,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));

    this.log(`Connected to "${name}" with ${tools.length} tools.`);
    this.connections.set(name, { client, transport, tools });
  }

  getServerStatuses(): { name: string; status: "connected" | "error" | "disabled"; toolCount: number }[] {
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
