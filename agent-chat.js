// NYC Housing Guide client: Firebase Google authentication plus a secure
// Cloudflare Worker proxy. Conversation text stays in sessionStorage only.
document.addEventListener("DOMContentLoaded", function () {
  const root = document.querySelector("[data-agent-root]");

  if (!root) {
    return;
  }

  const firebaseConfig = window.NYC_LIVING_PRIORITIES_FIREBASE_CONFIG;
  const agentConfig = window.NYC_HOUSING_GUIDE_CONFIG || {};
  const workerUrl = normalizeWorkerUrl(agentConfig.workerUrl);
  const appName = "nyc-living-priorities";
  const storagePrefix = "cdw-nyc-housing-guide-v1:";
  const maxHistoryMessages = 8;
  const maxUserCharacters = 500;

  const authStatus = root.querySelector("[data-agent-auth-status]");
  const authStatusText = authStatus.querySelector("span");
  const loginButton = root.querySelector("[data-agent-login]");
  const logoutButton = root.querySelector("[data-agent-logout]");
  const userCard = root.querySelector("[data-agent-user]");
  const userName = root.querySelector("[data-agent-user-name]");
  const userAvatar = root.querySelector("[data-agent-avatar]");
  const clearButton = root.querySelector("[data-agent-clear]");
  const quota = root.querySelector("[data-agent-quota]");
  const messagesElement = root.querySelector("[data-agent-messages]");
  const suggestionButtons = Array.from(root.querySelectorAll("[data-agent-suggestion]"));
  const form = root.querySelector("[data-agent-form]");
  const input = root.querySelector("[data-agent-input]");
  const characterCount = root.querySelector("[data-agent-character-count]");
  const sendButton = root.querySelector("[data-agent-send]");
  const feedback = root.querySelector("[data-agent-feedback]");

  let auth = null;
  let database = null;
  let currentUser = null;
  let activeUid = null;
  let history = [];
  let busy = false;
  let serviceAvailable = Boolean(workerUrl);
  let loadingMessage = null;

  if (window.location.hash === "#nyc-housing-guide") {
    window.addEventListener(
      "load",
      function () {
        window.setTimeout(function () {
          root.closest("#nyc-housing-guide").scrollIntoView({ block: "start" });
        }, 900);
      },
      { once: true }
    );
  }

  input.addEventListener("input", function () {
    characterCount.textContent = String(input.value.length);
    refreshControls();
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!sendButton.disabled) {
        form.requestSubmit();
      }
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    sendCurrentMessage();
  });

  loginButton.addEventListener("click", signInWithGoogle);
  logoutButton.addEventListener("click", signOut);
  clearButton.addEventListener("click", clearConversation);

  suggestionButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      if (button.disabled) {
        return;
      }

      input.value = button.dataset.agentSuggestion || "";
      characterCount.textContent = String(input.value.length);
      refreshControls();
      input.focus();
    });
  });

  if (!hasValidFirebaseConfig(firebaseConfig) || !window.firebase || !window.firebase.auth) {
    setAuthState("error", "Firebase Authentication setup required");
    setFeedback("The guide cannot start until Firebase Authentication is configured.", "error");
    renderWelcome("Firebase Authentication is not available on this page.");
    exposeState();
    return;
  }

  try {
    const existingApp = window.firebase.apps.find(function (app) {
      return app.name === appName;
    });
    const app = existingApp || window.firebase.initializeApp(firebaseConfig, appName);
    auth = app.auth();
    database = app.database();

    auth.onAuthStateChanged(
      function (user) {
        currentUser = user || null;
        activeUid = user ? user.uid : null;
        history = user ? readHistory(user.uid) : [];
        updateAuthenticatedView();
        exposeState();

        if (user && workerUrl) {
          checkServiceHealth();
        }

        if (user) {
          syncUsageCount(user.uid);
        }
      },
      function (error) {
        console.error("Firebase auth state failed:", error);
        setAuthState("error", "Firebase Authentication error");
        setFeedback("The Google sign-in state could not be loaded.", "error");
        refreshControls();
      }
    );
  } catch (error) {
    console.error("Firebase Authentication initialization failed:", error);
    setAuthState("error", "Firebase Authentication failed");
    setFeedback("Check the Firebase web configuration and Authentication settings.", "error");
    renderWelcome("Firebase Authentication could not be initialized.");
    refreshControls();
  }

  async function signInWithGoogle() {
    if (!auth || busy) {
      return;
    }

    busy = true;
    setFeedback("Opening Google sign-in...", "working");
    refreshControls();

    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await auth.setPersistence(window.firebase.auth.Auth.Persistence.SESSION);

      if (window.matchMedia("(max-width: 700px)").matches) {
        await auth.signInWithRedirect(provider);
        return;
      }

      await auth.signInWithPopup(provider);
    } catch (error) {
      if (error && error.code === "auth/popup-blocked") {
        await auth.signInWithRedirect(provider);
        return;
      }

      if (!error || error.code !== "auth/popup-closed-by-user") {
        console.error("Google sign-in failed:", error);
        setFeedback(readableAuthError(error), "error");
      } else {
        setFeedback("Google sign-in was canceled.", "neutral");
      }
    } finally {
      busy = false;
      refreshControls();
    }
  }

  async function signOut() {
    if (!auth || busy) {
      return;
    }

    busy = true;
    refreshControls();

    try {
      await auth.signOut();
    } catch (error) {
      console.error("Google sign-out failed:", error);
      setFeedback("Sign out failed. Please try again.", "error");
    } finally {
      busy = false;
      refreshControls();
    }
  }

  async function checkServiceHealth() {
    try {
      const response = await fetch(workerUrl + "/health", {
        method: "GET",
        cache: "no-store"
      });
      const data = await readJson(response);

      if (!response.ok || !data.ok || !data.openAIConfigured || !data.firebaseConfigured) {
        throw new Error("The agent service is not fully configured.");
      }

      serviceAvailable = true;
      setFeedback("Ready. Ask a question about the study.", "ready");
    } catch (error) {
      serviceAvailable = false;
      console.error("Agent health check failed:", error);
      setFeedback("The agent service is temporarily unavailable.", "error");
    }

    refreshControls();
    exposeState();
  }

  async function syncUsageCount(uid) {
    if (!database) {
      return;
    }

    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();

    try {
      const snapshot = await database.ref("agentUsage/" + uid + "/" + day).once("value");
      const storedValue = snapshot.val();
      const count = storedValue === null ? 0 : Number(storedValue);

      if (currentUser && currentUser.uid === uid && Number.isInteger(count) && count >= 0 && count <= 10) {
        updateQuota(10 - count, resetAt);
      }
    } catch (error) {
      console.warn("Daily request count could not be read:", error);
    }
  }

  async function sendCurrentMessage() {
    const text = input.value.trim();

    if (!currentUser || busy || !serviceAvailable || !text || text.length > maxUserCharacters) {
      return;
    }

    busy = true;
    input.value = "";
    characterCount.textContent = "0";
    appendHistoryMessage("user", text);
    showLoadingMessage();
    setFeedback("Reading the fixed dataset...", "working");
    refreshControls();

    try {
      const result = await callAgent(false);
      removeLoadingMessage();
      appendHistoryMessage("assistant", result.reply);
      updateQuota(result.remaining, result.resetAt);
      setFeedback("Answer generated from the website's fixed study data.", "ready");
    } catch (error) {
      removeLoadingMessage();
      removeFailedHistoryMessage(text);
      appendDisplayMessage("guide", error.message || "The guide could not answer this question.", true);
      setFeedback(error.message || "The guide could not answer this question.", "error");
    } finally {
      busy = false;
      refreshControls();
      exposeState();
    }
  }

  async function callAgent(forceRefresh) {
    const idToken = await currentUser.getIdToken(Boolean(forceRefresh));
    const response = await fetch(workerUrl + "/chat", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + idToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages: history.slice(-maxHistoryMessages) })
    });
    const data = await readJson(response);

    if (response.status === 401 && !forceRefresh) {
      return callAgent(true);
    }

    if (!response.ok) {
      throw new Error(readableServiceError(response.status, data));
    }

    if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("The guide returned an empty response. Please try again.");
    }

    return data;
  }

  function updateAuthenticatedView() {
    loginButton.hidden = Boolean(currentUser);
    userCard.hidden = !currentUser;

    if (!currentUser) {
      setAuthState("signed-out", "Google sign-in required");
      setFeedback("Sign in with Google to use the data guide.", "neutral");
      quota.textContent = "10 requests / UTC day";
      renderWelcome("Sign in with Google to ask about the evidence shown on this page.");
      refreshControls();
      return;
    }

    const displayName = currentUser.displayName || "Google user";
    userName.textContent = displayName;
    userAvatar.textContent = getInitials(displayName);
    setAuthState("signed-in", "Authenticated with Google");

    if (!workerUrl) {
      serviceAvailable = false;
      setFeedback("The Cloudflare Worker endpoint still needs to be deployed.", "error");
    } else {
      setFeedback("Checking the agent service...", "working");
    }

    renderHistory();
    refreshControls();
  }

  function renderHistory() {
    messagesElement.replaceChildren();

    if (!history.length) {
      renderWelcome("Ask me to compare boroughs, trace the 2020-2021 shift, or interpret the Manhattan hex map.");
      return;
    }

    history.forEach(function (message) {
      appendDisplayMessage(message.role === "user" ? "you" : "guide", message.content, false);
    });
    scrollMessages();
  }

  function renderWelcome(text) {
    messagesElement.replaceChildren();
    appendDisplayMessage("guide", text, false);
  }

  function appendHistoryMessage(role, content) {
    history.push({ role: role, content: content });
    history = history.slice(-maxHistoryMessages);
    writeHistory();
    appendDisplayMessage(role === "user" ? "you" : "guide", content, false);
    clearButton.disabled = false;
  }

  function removeFailedHistoryMessage(content) {
    const lastMessage = history.at(-1);

    if (lastMessage && lastMessage.role === "user" && lastMessage.content === content) {
      history.pop();
      writeHistory();
    }
  }

  function appendDisplayMessage(sender, content, isError) {
    const wrapper = document.createElement("div");
    const label = document.createElement("span");
    const paragraph = document.createElement("p");

    wrapper.className = "agent-message agent-message-" + sender + (isError ? " is-error" : "");
    label.textContent = sender === "you" ? "You" : "Guide";
    paragraph.textContent = content;
    wrapper.append(label, paragraph);
    messagesElement.append(wrapper);
    scrollMessages();
    return wrapper;
  }

  function showLoadingMessage() {
    loadingMessage = document.createElement("div");
    loadingMessage.className = "agent-message agent-message-guide is-loading";
    loadingMessage.innerHTML = "<span>Guide</span><p><i></i><i></i><i></i><b class=\"agent-sr-only\">Thinking</b></p>";
    messagesElement.append(loadingMessage);
    scrollMessages();
  }

  function removeLoadingMessage() {
    if (loadingMessage) {
      loadingMessage.remove();
      loadingMessage = null;
    }
  }

  function clearConversation() {
    history = [];
    writeHistory();
    renderWelcome("Conversation cleared. Ask a new question about the study.");
    setFeedback("Session conversation cleared.", "neutral");
    refreshControls();
    exposeState();
  }

  function readHistory(uid) {
    try {
      const raw = window.sessionStorage.getItem(storagePrefix + uid);
      const parsed = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(isValidStoredMessage).slice(-maxHistoryMessages);
    } catch (error) {
      console.warn("Session chat history could not be read:", error);
      return [];
    }
  }

  function writeHistory() {
    if (!activeUid) {
      return;
    }

    try {
      window.sessionStorage.setItem(storagePrefix + activeUid, JSON.stringify(history));
    } catch (error) {
      console.warn("Session chat history could not be saved:", error);
    }
  }

  function isValidStoredMessage(message) {
    return Boolean(
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.length > 0 &&
      message.content.length <= (message.role === "user" ? maxUserCharacters : 2200)
    );
  }

  function updateQuota(remaining, resetAt) {
    if (!Number.isInteger(remaining)) {
      return;
    }

    const suffix = remaining === 1 ? "request left" : "requests left";
    quota.textContent = remaining + " " + suffix;

    if (remaining === 0 && resetAt) {
      quota.title = "Resets at " + new Date(resetAt).toLocaleString();
    } else {
      quota.removeAttribute("title");
    }
  }

  function setAuthState(state, text) {
    authStatus.dataset.state = state;
    authStatusText.textContent = text;
  }

  function setFeedback(text, state) {
    feedback.textContent = text;
    feedback.dataset.state = state || "neutral";
  }

  function refreshControls() {
    const canChat = Boolean(currentUser && serviceAvailable && !busy);
    const hasText = input.value.trim().length > 0;

    loginButton.disabled = !auth || busy;
    logoutButton.disabled = busy;
    input.disabled = !canChat;
    input.placeholder = currentUser
      ? serviceAvailable
        ? "Ask about rent, inventory, vacancy, or the map..."
        : "Agent service unavailable"
      : "Sign in to ask about the study...";
    sendButton.disabled = !canChat || !hasText || input.value.trim().length > maxUserCharacters;
    clearButton.disabled = busy || history.length === 0;
    suggestionButtons.forEach(function (button) {
      button.disabled = !canChat;
    });
  }

  function exposeState() {
    window.__NYC_HOUSING_GUIDE_STATE__ = Object.freeze({
      authenticated: Boolean(currentUser),
      busy: busy,
      historyLength: history.length,
      serviceAvailable: serviceAvailable,
      workerConfigured: Boolean(workerUrl)
    });
  }

  function scrollMessages() {
    window.requestAnimationFrame(function () {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    });
  }

  function normalizeWorkerUrl(value) {
    if (typeof value !== "string" || !value.trim() || value.includes("WORKERS_SUBDOMAIN")) {
      return "";
    }

    try {
      const url = new URL(value.trim());
      const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

      if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) {
        return "";
      }

      return url.origin + url.pathname.replace(/\/$/, "");
    } catch (error) {
      return "";
    }
  }

  function hasValidFirebaseConfig(config) {
    return Boolean(
      config &&
      ["apiKey", "authDomain", "databaseURL", "projectId", "appId"].every(function (key) {
        return typeof config[key] === "string" && config[key].trim();
      })
    );
  }

  function getInitials(name) {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("");

    return initials || "NY";
  }

  function readableAuthError(error) {
    const code = error && error.code;

    if (code === "auth/unauthorized-domain") {
      return "This domain must be added to Firebase Authentication's authorized domains.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Google sign-in must be enabled in Firebase Authentication.";
    }
    if (code === "auth/network-request-failed") {
      return "Google sign-in could not reach Firebase. Check the network connection.";
    }

    return "Google sign-in failed. Please try again.";
  }

  function readableServiceError(status, data) {
    if (status === 400) {
      return data.error || "Check the message and try again.";
    }
    if (status === 401 || status === 403) {
      return "Your Google session could not be verified. Sign in again.";
    }
    if (status === 429) {
      return data.error || "The daily request limit has been reached.";
    }
    if (status === 503) {
      return data.error || "The data guide is temporarily busy. Please try again shortly.";
    }

    return data.error || "The data guide could not answer right now.";
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  exposeState();
  refreshControls();
});
