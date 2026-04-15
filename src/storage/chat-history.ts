import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { Chat, ChatMeta, ChatsIndex, ProviderType } from "../types/chat";

const BASE_DIR = path.join(os.homedir(), ".hime");
const CHATS_DIR = path.join(BASE_DIR, "chats");
const INDEX_FILE = path.join(BASE_DIR, "chats-index.json");

export class ChatHistoryStorage {
  private queue: Promise<any> = Promise.resolve();

  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => {},
      () => {}
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
      const filePath = path.join(CHATS_DIR, `${id}.json`);
      try {
        await fs.unlink(filePath);
      } catch (err: any) {
        if (err.code !== "ENOENT") throw err;
      }

      let index: ChatsIndex = { chats: [] };
      try {
        const data = await fs.readFile(INDEX_FILE, "utf-8");
        index = JSON.parse(data);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          console.error("Failed to read chat index for deletion:", err);
          throw err;
        }
      }

      index.chats = (index.chats || []).filter((c) => c.id !== id);
      await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
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
