import * as fs from "fs/promises";
import * as path from "path";
import { MCPTool } from "../types/mcp";

export const BUILTIN_TOOL_NAMES = new Set(["read_file", "list_directory", "search_files"]);

export function getBuiltinToolDefinitions(): MCPTool[] {
  return [
    {
      name: "read_file",
      description:
        "Read the contents of a file. Use this to view source code, configuration files, or any text file.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute path or workspace-relative path to the file",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "list_directory",
      description: "List files and subdirectories in a directory.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute path or workspace-relative path to the directory",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "search_files",
      description:
        "Search for a text pattern across files in a directory. Returns matching lines with file paths and line numbers.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Text or regex pattern to search for" },
          directory: {
            type: "string",
            description: "Directory to search in (defaults to workspace root)",
          },
          file_pattern: {
            type: "string",
            description: "Filename extension to filter files, e.g. '.ts'",
          },
        },
        required: ["pattern"],
      },
    },
  ];
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
  ".nuxt",
  "__pycache__",
  ".venv",
  "venv",
]);

const MAX_READ_LINES = 2000;
const MAX_SEARCH_RESULTS = 200;

export async function executeBuiltinTool(
  toolName: string,
  args: Record<string, unknown>,
  workspacePath: string
): Promise<string> {
  const resolvePath = (p: string): string =>
    path.isAbsolute(p) ? p : path.join(workspacePath, p);

  switch (toolName) {
    case "read_file": {
      const filePath = resolvePath(args.path as string);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      if (lines.length > MAX_READ_LINES) {
        return (
          lines.slice(0, MAX_READ_LINES).join("\n") +
          `\n\n... (truncated, showing ${MAX_READ_LINES}/${lines.length} lines)`
        );
      }
      return content;
    }

    case "list_directory": {
      const dirPath = resolvePath((args.path as string) || ".");
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const lines = entries
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      return lines.join("\n") || "(empty directory)";
    }

    case "search_files": {
      const patternStr = args.pattern as string;
      const dir = args.directory ? resolvePath(args.directory as string) : workspacePath;
      const fileExt = args.file_pattern as string | undefined;

      let regex: RegExp;
      try {
        regex = new RegExp(patternStr, "i");
      } catch {
        regex = new RegExp(patternStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      }

      const results: string[] = [];

      async function walk(currentDir: string): Promise<void> {
        if (results.length >= MAX_SEARCH_RESULTS) return;
        let entries: import("fs").Dirent[];
        try {
          entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (results.length >= MAX_SEARCH_RESULTS) return;
          if (entry.name.startsWith(".")) continue;
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) {
              await walk(fullPath);
            }
          } else {
            if (fileExt && !entry.name.endsWith(fileExt)) continue;
            let content: string;
            try {
              content = await fs.readFile(fullPath, "utf-8");
            } catch {
              continue;
            }
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                const relPath = path.relative(workspacePath, fullPath);
                results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                if (results.length >= MAX_SEARCH_RESULTS) break;
              }
            }
          }
        }
      }

      await walk(dir);

      if (results.length === 0) return "(no matches found)";
      const suffix = results.length >= MAX_SEARCH_RESULTS ? "\n\n... (truncated at 200 matches)" : "";
      return results.join("\n") + suffix;
    }

    default:
      throw new Error(`Unknown built-in tool: ${toolName}`);
  }
}
