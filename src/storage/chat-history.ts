import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { Chat, ChatMeta, ChatsIndex, ProviderType } from "../types/chat";

import * as vscode from "vscode";

const BASE_DIR = path.join(os.homedir(), ".hime");
const CHATS_DIR = path.join(BASE_DIR, "chats");
const INDEX_FILE = path.join(BASE_DIR, "chats-index.json");

export class ChatHistoryStorage {
  private queue: Promise<any> = Promise.resolve();
  private output: vscode.OutputChannel | undefined;

  constructor(output?: vscode.OutputChannel) {
    this.output = output;
  }

  private log(msg: string) {
    this.output?.appendLine(`[ChatHistoryStorage] ${msg}`);
  }

  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => {},
      (err) => {
        this.log(`Queue error: ${err.message || String(err)}`);
      }
    );
    return result;
  }

  async initialize(): Promise<void> {
    return this.enqueue(async () => {
      await fs.mkdir(CHATS_DIR, { recursive: true });
      try {
        await fs.access(INDEX_FILE);
      } catch {
        await fs.writeFile(INDEX_FILE, JSON.stringify({ chats: [] } satisfies ChatsIndex), "utf-8");
      }
    });
  }

  async listChats(): Promise<ChatMeta[]> {
    return this.enqueue(async () => {
      try {
        const data = await fs.readFile(INDEX_FILE, "utf-8");
        const index: ChatsIndex = JSON.parse(data);
        return index.chats || [];
      } catch (err: any) {
        if (err.code === "ENOENT") return [];
        console.error("Failed to read chat index:", err);
        throw err;
      }
    });
  }

  async loadChat(id: string): Promise<Chat> {
    const filePath = path.join(CHATS_DIR, `${id}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as Chat;
  }

  async saveChat(chat: Chat): Promise<void> {
    return this.enqueue(async () => {
      this.log(`Saving chat to disk: ${chat.id} (Title: ${chat.title})`);
      const filePath = path.join(CHATS_DIR, `${chat.id}.json`);
      await fs.mkdir(CHATS_DIR, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(chat, null, 2), "utf-8");

      let index: ChatsIndex = { chats: [] };
      try {
        const data = await fs.readFile(INDEX_FILE, "utf-8");
        index = JSON.parse(data);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          this.log(`Error reading index for saving: ${err.message}`);
          throw err;
        }
      }

      const chats = index.chats || [];
      const meta: ChatMeta = {
        id: chat.id,
        title: chat.title,
        provider: chat.provider,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length,
      };

      // Ensure comparison is robust
      const targetId = chat.id.trim().toLowerCase();
      const existingIndex = chats.findIndex((c) => {
        if (!c.id) return false;
        return c.id.trim().toLowerCase() === targetId;
      });

      if (existingIndex >= 0) {
        this.log(`Updating existing chat in index at position ${existingIndex}`);
        chats[existingIndex] = meta;
      } else {
        this.log(`Adding new chat to index: ${chat.id}`);
        chats.unshift(meta);
      }

      index.chats = chats;
      await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
      this.log(`Index updated successfully (Total chats: ${chats.length})`);
    });
  }

  async deleteChat(id: string): Promise<void> {
    return this.enqueue(async () => {
      this.log(`Requested deletion for ID: ${id}`);
      const filePath = path.join(CHATS_DIR, `${id}.json`);
      try {
        await fs.unlink(filePath);
        this.log(`Deleted individual chat file: ${filePath}`);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          this.log(`Error unlinking file ${filePath}: ${err.message}`);
          throw err;
        }
        this.log(`Note: Individual file not found for ${id}`);
      }

      let index: ChatsIndex = { chats: [] };
      try {
        const data = await fs.readFile(INDEX_FILE, "utf-8");
        index = JSON.parse(data);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          this.log(`Error reading index for deletion: ${err.message}`);
          throw err;
        }
      }

      const targetId = id.trim().toLowerCase();
      const initialCount = (index.chats || []).length;
      
      // Safety check for ID existence in each entry
      index.chats = (index.chats || []).filter((c) => {
        if (!c.id) {
          this.log(`Warning: Found chat entry without ID in index, removing it.`);
          return false;
        }
        const match = c.id.trim().toLowerCase() === targetId;
        return !match;
      });

      const afterCount = index.chats.length;
      this.log(`Filtering index: ${initialCount} -> ${afterCount} (Target: ${id})`);
      
      if (initialCount !== afterCount) {
        await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
        this.log(`Index updated: Removed ${initialCount - afterCount} entries matching ${id}`);
      } else {
        this.log(`ID ${id} NOT found in index. Current IDs: ${ (index.chats || []).map(c => c.id).join(', ') }`);
      }
    });
  }

  async createChat(provider: ProviderType): Promise<Chat> {
    const now = new Date().toISOString();
    const chat: Chat = {
      id: crypto.randomUUID(),
      title: "新しいチャット",
      provider,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.saveChat(chat);
    return chat;
  }
}
