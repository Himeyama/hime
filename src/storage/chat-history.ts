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
      const filePath = path.join(CHATS_DIR, `${chat.id}.json`);
      await fs.mkdir(CHATS_DIR, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(chat, null, 2), "utf-8");

      let index: ChatsIndex = { chats: [] };
      try {
        const data = await fs.readFile(INDEX_FILE, "utf-8");
        index = JSON.parse(data);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          console.error("Failed to read chat index for saving:", err);
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

      const existingIndex = chats.findIndex((c) => c.id === chat.id);
      if (existingIndex >= 0) {
        chats[existingIndex] = meta;
      } else {
        chats.unshift(meta);
      }

      index.chats = chats;
      await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
    });
  }

  async deleteChat(id: string): Promise<void> {
    return this.enqueue(async () => {
      this.log(`Start deleting chat: ${id}`);
      const filePath = path.join(CHATS_DIR, `${id}.json`);
      try {
        await fs.unlink(filePath);
        this.log(`Deleted file: ${filePath}`);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          this.log(`Error deleting file ${filePath}: ${err.message}`);
          throw err;
        }
        this.log(`File not found, skipping unlink: ${filePath}`);
      }

      let index: ChatsIndex = { chats: [] };
      try {
        const data = await fs.readFile(INDEX_FILE, "utf-8");
        index = JSON.parse(data);
        this.log(`Loaded index, contains ${index.chats?.length || 0} chats`);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          this.log(`Error reading index ${INDEX_FILE}: ${err.message}`);
          throw err;
        }
        this.log(`Index file not found, nothing to delete from index`);
      }

      const initialCount = index.chats?.length || 0;
      // Use case-insensitive comparison for safety, though UUIDs should be consistent
      index.chats = (index.chats || []).filter((c) => c.id.trim().toLowerCase() !== id.trim().toLowerCase());
      const afterCount = index.chats.length;
      
      this.log(`Filtering complete: ${initialCount} -> ${afterCount}`);
      
      if (initialCount !== afterCount) {
        await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
        this.log(`Index updated and written to disk`);
      } else {
        this.log(`No chat matching ID ${id} found in index, skipped writing`);
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
