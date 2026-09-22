const STORAGE = {
  usageExpires: "normax_usage_expires",
  infinite: "normax_infinite",
  redeemed: "normax_redeemed_codes",
  starter: "normax_starter_granted",
  settings: "normax_settings",
  messages: "normax_messages",
};

const STARTER_MINUTES = 45;

const PROMOS = {
  promo10: { minutes: 30, label: "30 minutes added" },
  free100: { minutes: 120, label: "2 hours added" },
};

const DEFAULT_SETTINGS = {
  mode: "light",
  style: "normax",
  speed: "balanced",
};

const els = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  chatLog: document.getElementById("chatLog"),
  chatForm: document.getElementById("chatForm"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  attachBtn: document.getElementById("attachBtn"),
  imageInput: document.getElementById("imageInput"),
  attachmentPreview: document.getElementById("attachmentPreview"),
  usageBadge: document.getElementById("usageBadge"),
  promoForm: document.getElementById("promoForm"),
  promoInput: document.getElementById("promoInput"),
  promoResult: document.getElementById("promoResult"),
  modeSelect: document.getElementById("modeSelect"),
  styleSelect: document.getElementById("styleSelect"),
  speedSelect: document.getElementById("speedSelect"),
  clearChatBtn: document.getElementById("clearChatBtn"),
};

let pendingImage = null;
let messages = loadMessages();

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadMessages() {
  return loadJson(STORAGE.messages, [
    {
      role: "assistant",
      content: "Welcome to ProjectNormax. Ask anything — you get free starter time, and promo codes add more.",
    },
  ]);
}

function persistMessages() {
  saveJson(STORAGE.messages, messages);
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...loadJson(STORAGE.settings, {}) };
}

function applySettings(settings) {
  document.documentElement.dataset.theme = settings.mode;
  document.documentElement.dataset.style = settings.style;
  document.documentElement.dataset.speed = settings.speed;
  els.modeSelect.value = settings.mode;
  els.styleSelect.value = settings.style;
  els.speedSelect.value = settings.speed;
}

function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  saveJson(STORAGE.settings, next);
  applySettings(next);
}

function isInfinite() {
  return localStorage.getItem(STORAGE.infinite) === "1";
}

function setInfinite(value) {
  if (value) localStorage.setItem(STORAGE.infinite, "1");
  else localStorage.removeItem(STORAGE.infinite);
}

function getUsageExpires() {
  const raw = localStorage.getItem(STORAGE.usageExpires);
  return raw ? Number(raw) : 0;
}

function addUsageMinutes(minutes) {
  const now = Date.now();
  const current = Math.max(getUsageExpires(), now);
  localStorage.setItem(STORAGE.usageExpires, String(current + minutes * 60 * 1000));
}

function hasAccess() {
  if (isInfinite()) return true;
  return getUsageExpires() > Date.now();
}

function formatRemaining() {
  if (isInfinite()) return "Unlimited access";
  const expires = getUsageExpires();
  const left = expires - Date.now();
  if (left <= 0) return "No time left — add a promo code";
  const mins = Math.ceil(left / 60000);
  if (mins >= 120) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m remaining` : `${h}h remaining`;
  }
  return `${mins} min remaining`;
}

function updateUsageBadge() {
  els.usageBadge.textContent = formatRemaining();
}

function getRedeemed() {
  return loadJson(STORAGE.redeemed, {});
}

function redeemPromo(rawCode) {
  const code = rawCode.trim();
  if (!code) return { ok: false, message: "Enter a code first." };

  const normalized = code.toLowerCase();
  const redeemed = getRedeemed();

  if (normalized === "inf") {
    setInfinite(true);
    redeemed[code] = Date.now();
    saveJson(STORAGE.redeemed, redeemed);
    updateUsageBadge();
    return { ok: true, message: "" };
  }

  const promo = PROMOS[normalized];
  if (!promo) {
    return { ok: false, message: "Invalid or unknown code." };
  }

  redeemed[normalized] = Date.now();
  saveJson(STORAGE.redeemed, redeemed);
  addUsageMinutes(promo.minutes);
  updateUsageBadge();
  return { ok: true, message: promo.label };
}

function renderMessages() {
  els.chatLog.innerHTML = "";
  for (const msg of messages) {
    const div = document.createElement("div");
    div.className = `msg ${msg.role === "user" ? "user" : msg.role === "system" ? "system" : "assistant"}`;
    if (typeof msg.content === "string") {
      div.textContent = msg.content;
    } else if (msg.imagePreview) {
      div.textContent = msg.content || "";
      const img = document.createElement("img");
      img.src = msg.imagePreview;
      img.alt = "Attached image";
      div.appendChild(img);
    }
    els.chatLog.appendChild(div);
  }
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function appendMessage(message) {
  messages.push(message);
  persistMessages();
  renderMessages();
}

function setAttachment(file) {
  pendingImage = file;
  if (!file) {
    els.attachmentPreview.classList.add("hidden");
    els.attachmentPreview.innerHTML = "";
    return;
  }
  els.attachmentPreview.classList.remove("hidden");
  els.attachmentPreview.innerHTML = "";
  const label = document.createElement("span");
  label.textContent = file.name;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Remove";
  clear.addEventListener("click", () => {
    pendingImage = null;
    els.imageInput.value = "";
    setAttachment(null);
  });
  els.attachmentPreview.append(label, clear);
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function sendChat() {
  const text = els.messageInput.value.trim();
  if (!text && !pendingImage) return;

  if (!hasAccess()) {
    appendMessage({
      role: "system",
      content: "Your chat time ran out. Add a promo code on the Promo Codes tab to keep going.",
    });
    return;
  }

  let imageBase64 = null;
  let imageMime = null;
  let previewUrl = null;

  if (pendingImage) {
    imageMime = pendingImage.type || "image/jpeg";
    imageBase64 = await fileToBase64(pendingImage);
    previewUrl = URL.createObjectURL(pendingImage);
  }

  const userDisplay = {
    role: "user",
    content: text || "(image)",
    imagePreview: previewUrl || undefined,
  };
  appendMessage(userDisplay);

  const apiMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : m.content || "",
    }));

  if (imageBase64) {
    const last = apiMessages[apiMessages.length - 1];
    last.image = { base64: imageBase64, mimeType: imageMime };
  }

  els.messageInput.value = "";
  els.messageInput.style.height = "auto";
  setAttachment(null);
  els.imageInput.value = "";
  els.sendBtn.disabled = true;

  try {
    const settings = getSettings();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiMessages, speed: settings.speed }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    appendMessage({ role: "assistant", content: data.reply || "No response." });
  } catch (err) {
    appendMessage({
      role: "system",
      content: err.message || "Something went wrong. Check POLLINATIONS_API_KEY on Vercel.",
    });
  } finally {
    els.sendBtn.disabled = false;
    updateUsageBadge();
  }
}

function initTabs() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      els.tabs.forEach((t) => {
        const active = t.dataset.tab === name;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      els.panels.forEach((panel) => {
        const id = panel.id.replace("panel-", "");
        const active = id === name;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    });
  });
}

function initComposer() {
  els.messageInput.addEventListener("input", () => {
    els.messageInput.style.height = "auto";
    els.messageInput.style.height = `${Math.min(els.messageInput.scrollHeight, 120)}px`;
  });

  els.attachBtn.addEventListener("click", () => els.imageInput.click());
  els.imageInput.addEventListener("change", () => {
    const file = els.imageInput.files?.[0];
    if (file) setAttachment(file);
  });

  els.chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sendChat();
  });

  els.messageInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    sendChat();
  });
}

function initPromo() {
  els.promoForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const result = redeemPromo(els.promoInput.value);
    els.promoResult.textContent = result.message;
    els.promoResult.style.color = result.ok ? "var(--accent)" : "#f87171";
    if (result.ok) els.promoInput.value = "";
  });
}

function initSettings() {
  applySettings(getSettings());

  els.modeSelect.addEventListener("change", () => saveSettings({ mode: els.modeSelect.value }));
  els.styleSelect.addEventListener("change", () => saveSettings({ style: els.styleSelect.value }));
  els.speedSelect.addEventListener("change", () => saveSettings({ speed: els.speedSelect.value }));

  els.clearChatBtn.addEventListener("click", () => {
    messages = [
      {
        role: "assistant",
        content: "Chat cleared. How can I help?",
      },
    ];
    persistMessages();
    renderMessages();
  });
}

function grantStarterTime() {
  if (localStorage.getItem(STORAGE.starter) === "1") return;
  if (!isInfinite() && getUsageExpires() <= Date.now()) {
    addUsageMinutes(STARTER_MINUTES);
  }
  localStorage.setItem(STORAGE.starter, "1");
}

initTabs();
initComposer();
initPromo();
initSettings();
grantStarterTime();
renderMessages();
updateUsageBadge();

setInterval(updateUsageBadge, 30000);
