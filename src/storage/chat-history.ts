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
        return index.chats;
      } catch {
        return [];
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
      await fs.writeFile(filePath, JSON.stringify(chat, null, 2), "utf-8");

      // We need to read the index inside the queue to ensure we have the latest data
      let chats: ChatMeta[] = [];
      try {
        const data = await fs.readFile(INDEX_FILE, "utf-8");
        chats = (JSON.parse(data) as ChatsIndex).chats;
      } catch {
        chats = [];
      }

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

      const index: ChatsIndex = { chats };
      await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
    });
  }

  async deleteChat(id: string): Promise<void> {
    return this.enqueue(async () => {
      const filePath = path.join(CHATS_DIR, `${id}.json`);
      try {
        await fs.unlink(filePath);
      } catch {
        // File may not exist
      }

      let chats: ChatMeta[] = [];
      try {
        const data = await fs.readFile(INDEX_FILE, "utf-8");
        chats = (JSON.parse(data) as ChatsIndex).chats;
      } catch {
        chats = [];
      }

      const filtered = chats.filter((c) => c.id !== id);
      const index: ChatsIndex = { chats: filtered };
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
