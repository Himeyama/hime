import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsStorage } from '../src/storage/settings';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

vi.mock('fs/promises');
vi.mock('os');

describe('SettingsStorage', () => {
  const mockHomedir = '/mock/home';
  const mockBaseDir = path.join(mockHomedir, '.hime');
  const mockSettingsFile = path.join(mockBaseDir, 'settings.json');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHomedir);
  });

  it('should initialize with default settings if file does not exist', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const storage = new SettingsStorage();
    await storage.initialize();

    expect(fs.mkdir).toHaveBeenCalledWith(mockBaseDir, { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      mockSettingsFile,
      expect.stringContaining('"defaultProvider": "anthropic"'),
      'utf-8'
    );
  });

  it('should load settings from file', async () => {
    const mockSettings = {
      defaultProvider: 'openai',
      providers: {
        openai: { model: 'gpt-4o' }
      },
      systemPrompt: 'test prompt',
      mcpServers: {}
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSettings));

    const storage = new SettingsStorage();
    const settings = await storage.load();

    expect(settings.defaultProvider).toBe('openai');
    expect(settings.systemPrompt).toBe('test prompt');
    expect(fs.readFile).toHaveBeenCalledWith(mockSettingsFile, 'utf-8');
  });

  it('should update settings', async () => {
    const initialSettings = {
      defaultProvider: 'anthropic',
      providers: {
        anthropic: { model: 'claude-3' }
      },
      systemPrompt: '',
      mcpServers: {}
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(initialSettings));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const storage = new SettingsStorage();
    await storage.update({ systemPrompt: 'new prompt' });

    expect(fs.writeFile).toHaveBeenCalledWith(
      mockSettingsFile,
      expect.stringContaining('"systemPrompt": "new prompt"'),
      'utf-8'
    );
  });
});
