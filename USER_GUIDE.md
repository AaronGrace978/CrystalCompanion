# Crystal Companion — User Guide

A luminous digital guide that recommends crystals for healing, protection, manifestation, and more — powered by the AI oracle you choose.

---

## Awakening

1. Launch the app (`npm start`).
2. Press **Awaken** on the opening veil.
3. The living crystal forms while the opening song rises from inside the stone — muffled at first, then blooming into full light as the filter opens and pitch finds true tone.
4. When the veil fades, you may speak to the crystal.

Browsers (and Electron) require a user gesture before audio can play. That is why Awaken exists — it is the ritual that unlocks sound.

---

## Asking the Crystal

Type in the glowing chat box on the right:

- *Which crystal helps with anxiety and sleep?*
- *I need protection for travel — what should I carry?*
- *Recommend a manifestation grid for new work.*
- *Compare rose quartz and rhodonite for heart healing.*

Press **Enter** to send (Shift+Enter for a new line), or tap the radiant send button.

Replies appear as **glowing crystal text** — the companion’s voice in light.

---

## Attunement (Settings)

Open the gear icon (**Attunement**) to configure your oracle.

### Providers

| Provider | What it is | What you need |
|----------|------------|---------------|
| **OpenRouter Cloud** | Unified cloud API — hundreds of models | OpenRouter API key |
| **Ollama Cloud** | Hosted models on ollama.com — full live catalog | Ollama Cloud API key ([settings/keys](https://ollama.com/settings/keys)) |
| **Ollama (Local)** | Models running on your machine | Ollama installed & running |
| **OpenAI** | GPT / o-series models | OpenAI API key |
| **Anthropic** | Claude models | Anthropic API key |

### Models dropdown

- After choosing a provider (and entering a key if needed), click **Refresh**.
- **OpenRouter** loads the full live model catalog from their API.
- **Ollama Cloud** loads every model currently published on `https://ollama.com/api/tags`.
- **Ollama (Local)** lists whatever you have pulled locally (`ollama list`).
- **OpenAI** lists chat-capable models from your account (with sensible fallbacks).
- **Anthropic** offers the current Claude lineup.

Pick a model, adjust **Temperature** (higher = more poetic wander; lower = tighter recommendations), optionally edit the **System essence**, then **Seal settings**.

### Keys stay local

API keys are saved on your machine in Electron’s user data folder — not uploaded anywhere except to the provider you selected when you send a message.

---

## Sound

- **Awakening song** — the bundled track that births with the crystal. Toggle and volume live in Attunement.
- **Crystal tones** — chimes on send, receive, open panels, and errors. Synthesized in real time; no extra downloads.

The crystal’s glow **pulses with the music** — bass and harmonics feed the raymarched light.

---

## The Living Crystal

The centerpiece is a **raymarched** crystal: a real-time ray-traced volume of facets, inner lattice, and orbiting shards.

- It breathes and rotates on its own.
- It brightens when you speak or when a reply arrives.
- It listens to the song and answers with light.

No images — pure shader magic.

---

## Tips for better guidance

- Name your **intention** clearly (heal, protect, manifest, ground, love, clarity…).
- Mention **constraints** (budget, size, jewelry vs pocket stone, sensitive to water, etc.).
- Ask for **how to use** the stone, not only which one.
- You can keep a conversation going — context stays for the session.

---

## Troubleshooting

| Symptom | Try this |
|---------|----------|
| No models in dropdown | Refresh; check key; for Ollama Local ensure `ollama serve` is running; for Ollama Cloud check network |
| Chat error | Confirm key/provider/model; check network; read the crystal’s error glow |
| No music | Press Awaken; enable Awakening song; raise Music slider |
| Crystal blank | GPU/WebGL issue — update drivers; avoid software-only GL |
| Ollama Local fails | Default URL `http://127.0.0.1:11434` — change if your server differs |
| Ollama Cloud 401 | Create a key at [ollama.com/settings/keys](https://ollama.com/settings/keys) and paste it in Attunement |

---

## Run from source

```bash
cd CrystalCompanion
npm install
npm start
```

Requires Node.js 18+ and a machine that can run Electron.

---

## Philosophy

This companion is a **guide**, not a medical authority. Crystal work is personal, symbolic, and cultural. Use recommendations as inspiration — and care for your body and mind with appropriate professional help when needed.

May your lattice hold steady light.
