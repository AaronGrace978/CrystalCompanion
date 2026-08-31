(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let settings = null;
  let messages = [];
  let busy = false;
  let welcomeShown = false;

  const els = {
    boot: $('#boot'),
    awaken: $('#btn-awaken'),
    messages: $('#messages'),
    form: $('#composer'),
    prompt: $('#prompt'),
    send: $('#btn-send'),
    hint: $('#model-hint'),
    status: $('#status-line'),
    settingsBtn: $('#btn-settings'),
    guideBtn: $('#btn-guide'),
    settingsDrawer: $('#settings-drawer'),
    guideDrawer: $('#guide-drawer'),
    guideContent: $('#guide-content'),
    provider: $('#set-provider'),
    openrouterKey: $('#set-openrouter-key'),
    openaiKey: $('#set-openai-key'),
    anthropicKey: $('#set-anthropic-key'),
    ollamaKey: $('#set-ollama-key'),
    ollamaUrl: $('#set-ollama-url'),
    model: $('#set-model'),
    refreshModels: $('#btn-refresh-models'),
    temperature: $('#set-temperature'),
    tempVal: $('#temp-val'),
    system: $('#set-system'),
    music: $('#set-music'),
    sfx: $('#set-sfx'),
    musicVol: $('#set-music-vol'),
    sfxVol: $('#set-sfx-vol'),
    saveSettings: $('#btn-save-settings')
  };

  const STATUS_LINES = [
    'Listening…',
    'Resonating…',
    'Holding light…',
    'Attuned…',
    'Crystal still…',
    'Ready to guide…'
  ];

  function setStatus(text) {
    els.status.textContent = text;
  }

  function cycleStatus() {
    if (busy) return;
    const line = STATUS_LINES[Math.floor(Math.random() * STATUS_LINES.length)];
    setStatus(line);
  }

  setInterval(cycleStatus, 7000);

  function openDrawer(name) {
    const el = name === 'settings' ? els.settingsDrawer : els.guideDrawer;
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    CrystalAudio.click();
    if (name === 'settings') CrystalAudio.open();
  }

  function closeDrawer(name) {
    const el = name === 'settings' ? els.settingsDrawer : els.guideDrawer;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    CrystalAudio.click();
  }

  function applyProviderVisibility() {
    const p = els.provider.value;
    $$('.field[data-show]').forEach((f) => {
      f.classList.toggle('visible', f.dataset.show === p);
    });
  }

  function fillSettingsForm() {
    els.provider.value = settings.provider || 'openrouter';
    els.openrouterKey.value = settings.openrouterKey || '';
    els.openaiKey.value = settings.openaiKey || '';
    els.anthropicKey.value = settings.anthropicKey || '';
    els.ollamaKey.value = settings.ollamaKey || '';
    els.ollamaUrl.value = settings.ollamaUrl || 'http://127.0.0.1:11434';
    els.temperature.value = settings.temperature ?? 0.85;
    els.tempVal.textContent = Number(els.temperature.value).toFixed(2);
    els.system.value = settings.systemPrompt || '';
    els.music.checked = settings.musicEnabled !== false;
    els.sfx.checked = settings.sfxEnabled !== false;
    els.musicVol.value = settings.musicVolume ?? 0.45;
    els.sfxVol.value = settings.sfxVolume ?? 0.55;
    applyProviderVisibility();
  }

  function readSettingsForm() {
    return {
      provider: els.provider.value,
      openrouterKey: els.openrouterKey.value.trim(),
      openaiKey: els.openaiKey.value.trim(),
      anthropicKey: els.anthropicKey.value.trim(),
      ollamaKey: els.ollamaKey.value.trim(),
      ollamaUrl: els.ollamaUrl.value.trim() || 'http://127.0.0.1:11434',
      model: els.model.value,
      temperature: Number(els.temperature.value),
      systemPrompt: els.system.value,
      musicEnabled: els.music.checked,
      sfxEnabled: els.sfx.checked,
      musicVolume: Number(els.musicVol.value),
      sfxVolume: Number(els.sfxVol.value)
    };
  }

  function updateHint() {
    const p = settings.provider;
    const m = settings.model;
    if (!m) {
      els.hint.textContent = 'Open Settings → choose provider & model';
    } else {
      els.hint.textContent = `${p} · ${m}`;
    }
  }

  async function refreshModels(selectId) {
    const draft = readSettingsForm();
    els.model.innerHTML = '<option value="">Loading models…</option>';
    const result = await window.crystal.listModels(draft.provider, draft);
    const models = Array.isArray(result) ? result : result.models || [];
    const err = result && result.error;

    els.model.innerHTML = '';
    if (!models.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = err
        ? `Error: ${err.slice(0, 60)}`
        : draft.provider === 'ollama'
          ? 'No local models — is Ollama running?'
          : draft.provider === 'ollama-cloud'
            ? 'No cloud models — check network'
            : 'No models — check API key';
      els.model.appendChild(opt);
      return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = `— ${models.length} models —`;
    els.model.appendChild(placeholder);

    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name || m.id;
      els.model.appendChild(opt);
    }

    const prefer = selectId || settings.model;
    if (prefer && [...els.model.options].some((o) => o.value === prefer)) {
      els.model.value = prefer;
    }
  }

  function addMessage(role, content, { thinking = false } = {}) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${role}${thinking ? ' thinking' : ''}`;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = role === 'user' ? 'Seeker' : 'Crystal';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (thinking) {
      bubble.innerHTML =
        'Gathering light <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>';
    } else if (role === 'assistant') {
      bubble.innerHTML = CrystalMD.formatChat(content);
    } else {
      bubble.textContent = content;
    }
    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    els.messages.appendChild(wrap);
    els.messages.scrollTop = els.messages.scrollHeight;
    return wrap;
  }

  function showWelcome() {
    if (welcomeShown) return;
    welcomeShown = true;
    addMessage(
      'assistant',
      'I am awake within the lattice.\n\nAsk me for stones of **healing**, **protection**, **manifestation**, grounding, love, or clarity — and I will name what resonates, and how to work with it.\n\nOpen **Attunement** (settings) to choose your oracle: OpenRouter, Ollama Cloud, Ollama Local, OpenAI, or Anthropic.'
    );
  }

  async function sendPrompt(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!settings.model) {
      openDrawer('settings');
      setStatus('Choose a model…');
      CrystalAudio.error();
      return;
    }

    busy = true;
    els.send.disabled = true;
    els.prompt.value = '';
    autosize();
    messages.push({ role: 'user', content: trimmed });
    addMessage('user', trimmed);
    CrystalAudio.send();
    if (window.CrystalVisual) {
      CrystalVisual.resonate(trimmed, 1.25);
      CrystalVisual.thinking(true);
    }
    setStatus('Communing…');
    CrystalAudio.think();

    const thinkingEl = addMessage('assistant', '', { thinking: true });

    try {
      const res = await window.crystal.sendChat(messages, settings);
      const content = (res.content || '').trim() || '…silence. Try again, seeker.';
      messages.push({ role: 'assistant', content });
      thinkingEl.remove();
      addMessage('assistant', content);
      CrystalAudio.receive();
      if (window.CrystalVisual) {
        CrystalVisual.thinking(false);
        CrystalVisual.resonate(content.slice(0, 120), 1.05);
      }
      setStatus('Attuned…');
    } catch (err) {
      thinkingEl.remove();
      addMessage('assistant', `The crystal flickered.\n\n*${err.message || err}*`);
      CrystalAudio.error();
      if (window.CrystalVisual) {
        CrystalVisual.thinking(false);
        CrystalVisual.resonate('error-flare', 0.7);
      }
      setStatus('Unstable…');
      // remove failed user turn? keep it for context retry
    } finally {
      busy = false;
      els.send.disabled = false;
      els.prompt.focus();
    }
  }

  function autosize() {
    const el = els.prompt;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  // Events
  els.awaken.addEventListener('click', async () => {
    els.awaken.disabled = true;
    els.awaken.textContent = 'Awakening…';
    setStatus('Awakening…');

    let songData;
    try {
      songData = await window.crystal.getSongBuffer();
    } catch (_) {
      songData = await window.crystal.getSongPath();
    }

    await CrystalAudio.awaken(songData, {
      musicEnabled: settings.musicEnabled !== false,
      musicVol: settings.musicVolume ?? 0.45,
      sfxVol: settings.sfxVolume ?? 0.55
    });

    if (window.CrystalVisual) CrystalVisual.resonate('awaken', 1.4);

    els.boot.classList.add('fade-out');
    setTimeout(() => {
      els.boot.remove();
      showWelcome();
      setStatus('Ready to guide…');
      els.prompt.focus();
    }, 1600);
  });

  els.settingsBtn.addEventListener('click', () => {
    fillSettingsForm();
    refreshModels(settings.model);
    openDrawer('settings');
  });

  els.guideBtn.addEventListener('click', async () => {
    const md = await window.crystal.getGuide();
    els.guideContent.innerHTML = CrystalMD.renderMarkdown(md);
    openDrawer('guide');
  });

  $$('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeDrawer(btn.dataset.close));
  });

  els.provider.addEventListener('change', () => {
    applyProviderVisibility();
    refreshModels();
    CrystalAudio.click();
  });

  els.refreshModels.addEventListener('click', () => {
    CrystalAudio.click();
    refreshModels();
  });

  els.temperature.addEventListener('input', () => {
    els.tempVal.textContent = Number(els.temperature.value).toFixed(2);
  });

  els.music.addEventListener('change', () => {
    CrystalAudio.setMusicEnabled(els.music.checked);
  });
  els.sfx.addEventListener('change', () => {
    CrystalAudio.setSfxEnabled(els.sfx.checked);
  });
  els.musicVol.addEventListener('input', () => {
    CrystalAudio.setMusicVolume(Number(els.musicVol.value));
  });
  els.sfxVol.addEventListener('input', () => {
    CrystalAudio.setSfxVolume(Number(els.sfxVol.value));
  });

  els.saveSettings.addEventListener('click', async () => {
    const next = readSettingsForm();
    settings = await window.crystal.saveSettings(next);
    CrystalAudio.setMusicEnabled(settings.musicEnabled);
    CrystalAudio.setSfxEnabled(settings.sfxEnabled);
    CrystalAudio.setMusicVolume(settings.musicVolume);
    CrystalAudio.setSfxVolume(settings.sfxVolume);
    updateHint();
    CrystalAudio.receive();
    if (window.CrystalVisual) CrystalVisual.resonate('settings-sealed', 0.65);
    closeDrawer('settings');
    setStatus('Settings sealed…');
  });

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendPrompt(els.prompt.value);
  });

  els.prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(els.prompt.value);
    }
  });

  els.prompt.addEventListener('input', autosize);

  // Boot
  async function init() {
    settings = await window.crystal.getSettings();
    fillSettingsForm();
    updateHint();
    CrystalAudio.setMusicEnabled(settings.musicEnabled !== false);
    CrystalAudio.setSfxEnabled(settings.sfxEnabled !== false);
    CrystalAudio.setMusicVolume(settings.musicVolume ?? 0.45);
    CrystalAudio.setSfxVolume(settings.sfxVolume ?? 0.55);

    // Prefetch song while on awaken screen (decode ok; playback needs Awaken gesture)
    try {
      CrystalAudio.ensure();
      const buf = await window.crystal.getSongBuffer();
      await CrystalAudio.loadSong(buf);
    } catch (_) {}
  }

  init();
})();
