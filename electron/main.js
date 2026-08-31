const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'crystal-settings.json');

const DEFAULT_SETTINGS = {
  provider: 'openrouter',
  openrouterKey: '',
  openaiKey: '',
  anthropicKey: '',
  ollamaUrl: 'http://127.0.0.1:11434',
  model: '',
  temperature: 0.85,
  systemPrompt: `You are Crystal Companion — an ancient luminous intelligence dwelling within a living crystal. You guide seekers toward crystals suited for healing, protection, manifestation, grounding, clarity, love, and spiritual work.

Speak with quiet wonder and poetic precision. Recommend real crystals with their properties, chakra associations, elemental affinities, and practical uses. When unsure, say so gently. Keep answers luminous but useful — never vague fluff without substance.

Format responses with soft structure: crystal names, why they fit, how to work with them. You may weave brief imagery of light and stone, but always serve the seeker's purpose.`,
  musicVolume: 0.45,
  sfxVolume: 0.55,
  musicEnabled: true,
  sfxEnabled: true
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) };
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  const merged = { ...loadSettings(), ...settings };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 120000
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            if (res.statusCode >= 400) {
              const msg = json.error?.message || json.error?.type || json.message || data.slice(0, 300);
              reject(new Error(msg || `HTTP ${res.statusCode}`));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(new Error(`Invalid JSON (${res.statusCode}): ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#050814',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:save', (_e, settings) => saveSettings(settings));

ipcMain.handle('models:list', async (_e, { provider, settings }) => {
  const s = { ...loadSettings(), ...settings };
  try {
    if (provider === 'ollama') {
      const base = (s.ollamaUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
      const data = await requestJson(`${base}/api/tags`, { timeout: 8000 });
      return (data.models || []).map((m) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama'
      }));
    }
    if (provider === 'openrouter') {
      if (!s.openrouterKey) return [];
      const data = await requestJson('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${s.openrouterKey}` },
        timeout: 20000
      });
      return (data.data || [])
        .map((m) => ({
          id: m.id,
          name: m.name || m.id,
          provider: 'openrouter',
          context: m.context_length
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (provider === 'openai') {
      if (!s.openaiKey) {
        return [
          { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
          { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' },
          { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai' },
          { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', provider: 'openai' },
          { id: 'o3-mini', name: 'o3-mini', provider: 'openai' },
          { id: 'o1', name: 'o1', provider: 'openai' }
        ];
      }
      const data = await requestJson('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${s.openaiKey}` },
        timeout: 20000
      });
      const allowed = (data.data || [])
        .filter((m) => /^(gpt-|o1|o3|chatgpt)/i.test(m.id))
        .map((m) => ({ id: m.id, name: m.id, provider: 'openai' }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return allowed.length ? allowed : [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' }
      ];
    }
    if (provider === 'anthropic') {
      return [
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic' },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'anthropic' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' }
      ];
    }
    return [];
  } catch (err) {
    return { error: err.message, models: [] };
  }
});

ipcMain.handle('chat:send', async (_e, { messages, settings }) => {
  const s = { ...loadSettings(), ...settings };
  const provider = s.provider || 'openrouter';
  const model = s.model;
  if (!model) throw new Error('Choose a model in Settings first.');

  const system = s.systemPrompt || DEFAULT_SETTINGS.systemPrompt;
  const temp = typeof s.temperature === 'number' ? s.temperature : 0.85;

  if (provider === 'ollama') {
    const base = (s.ollamaUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
    const data = await requestJson(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 180000
    }, {
      model,
      stream: false,
      options: { temperature: temp },
      messages: [{ role: 'system', content: system }, ...messages]
    });
    return { content: data.message?.content || '' };
  }

  if (provider === 'openrouter') {
    if (!s.openrouterKey) throw new Error('Add your OpenRouter API key in Settings.');
    const data = await requestJson('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s.openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crystalcompanion.local',
        'X-Title': 'Crystal Companion'
      },
      timeout: 120000
    }, {
      model,
      temperature: temp,
      messages: [{ role: 'system', content: system }, ...messages]
    });
    return { content: data.choices?.[0]?.message?.content || '' };
  }

  if (provider === 'openai') {
    if (!s.openaiKey) throw new Error('Add your OpenAI API key in Settings.');
    const data = await requestJson('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s.openaiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }, {
      model,
      temperature: temp,
      messages: [{ role: 'system', content: system }, ...messages]
    });
    return { content: data.choices?.[0]?.message?.content || '' };
  }

  if (provider === 'anthropic') {
    if (!s.anthropicKey) throw new Error('Add your Anthropic API key in Settings.');
    const data = await requestJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': s.anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }, {
      model,
      max_tokens: 4096,
      temperature: temp,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    });
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return { content: text };
  }

  throw new Error(`Unknown provider: ${provider}`);
});

function resolveSongPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'awakening.wav'),
    path.join(__dirname, '..', 'assets', 'awakening.wav'),
    path.join(__dirname, '..', 'Afterglow of the Dying Star (Final Fantasy Remix).wav')
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return candidates[1];
}

ipcMain.handle('app:getSongPath', () => {
  const song = resolveSongPath();
  const normalized = path.resolve(song).replace(/\\/g, '/');
  const encoded = normalized
    .split('/')
    .map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
    .join('/');
  return `file:///${encoded}`;
});

ipcMain.handle('app:getSongBuffer', async () => {
  const song = resolveSongPath();
  const buf = fs.readFileSync(song);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

ipcMain.handle('app:openExternal', (_e, url) => shell.openExternal(url));

ipcMain.handle('app:getGuide', () => {
  const guidePath = path.join(__dirname, '..', 'USER_GUIDE.md');
  try {
    return fs.readFileSync(guidePath, 'utf8');
  } catch {
    return '# Crystal Companion\n\nGuide not found.';
  }
});
