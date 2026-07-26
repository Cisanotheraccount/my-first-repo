// Firebase Realtime Database engagement poll.
// The flow follows the course tutorial: initialize Firebase, listen for live
// values, write one vote, and report the database connection state.
document.addEventListener("DOMContentLoaded", function () {
  const root = document.querySelector("[data-poll-root]");

  if (!root) {
    return;
  }

  const optionDetails = Object.freeze({
    affordability: "Affordability",
    space: "Space",
    commute: "Commute",
    community: "Community"
  });
  const optionKeys = Object.keys(optionDetails);
  const storageKey = "cdw-living-priorities-v3";
  const appName = "nyc-living-priorities";
  const buttons = Array.from(root.querySelectorAll("[data-poll-option]"));
  const resultGroups = Array.from(root.querySelectorAll("[data-poll-result]"));
  const codeField = root.querySelector(".poll-code-field");
  const codeInput = root.querySelector("[data-poll-code]");
  const codeState = root.querySelector("[data-poll-code-state]");
  const totalElement = root.querySelector("[data-poll-total]");
  const totalLabel = root.querySelector("[data-poll-total-label]");
  const skyline = root.querySelector("[data-poll-skyline]");
  const connection = root.querySelector("[data-poll-connection]");
  const connectionText = connection.querySelector("span");
  const feedback = root.querySelector("[data-poll-feedback]");
  const emptyCounts = {
    affordability: 0,
    space: 0,
    commute: 0,
    community: 0
  };

  const storedVote = readStoredVote();
  let counts = { ...emptyCounts };
  let submittedVote = storedVote ? storedVote.option : null;
  let submittedVoterId = storedVote ? storedVote.voterId : null;
  let connected = false;
  let dataReady = false;
  let busy = false;
  let database = null;
  let votesReference = null;

  markSubmittedVote();
  updateCodeState();
  updateResults(counts, false);
  exposeState();

  codeInput.addEventListener("input", function () {
    codeInput.value = codeInput.value.toUpperCase();
    updateCodeState();
    refreshButtons();
  });

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      submitVote(button.dataset.pollOption);
    });
  });

  const firebaseConfig = window.NYC_LIVING_PRIORITIES_FIREBASE_CONFIG;

  if (!hasValidFirebaseConfig(firebaseConfig) || !window.firebase) {
    setConnectionState("error", "Firebase setup required");
    setFeedback("Open this page through its web server after Firebase is configured.");
    refreshButtons();
    return;
  }

  try {
    const existingApp = window.firebase.apps.find(function (app) {
      return app.name === appName;
    });
    const app = existingApp || window.firebase.initializeApp(firebaseConfig, appName);
    database = app.database();
    votesReference = database.ref("livingPrioritiesPoll/votes");

    votesReference.on(
      "value",
      function (snapshot) {
        dataReady = true;
        counts = aggregateVotes(snapshot.val());
        updateResults(counts, true);
        refreshButtons();

        if (submittedVote) {
          setFeedback("Your vote: " + optionDetails[submittedVote] + ".");
        } else if (connected) {
          setFeedback("Enter a voting code and choose one priority.");
        }
      },
      function (error) {
        dataReady = false;
        setConnectionState("error", "Database permission error");
        setFeedback("The live results could not be loaded. Check the Firebase database rules.");
        refreshButtons();
        console.error("Firebase poll read failed:", error);
      }
    );

    database.ref(".info/connected").on("value", function (snapshot) {
      connected = snapshot.val() === true;

      if (connected) {
        setConnectionState("connected", "Connected to Firebase");
        if (submittedVote) {
          setFeedback("Your vote: " + optionDetails[submittedVote] + ".");
        } else if (dataReady) {
          setFeedback("Enter a voting code and choose one priority.");
        }
      } else {
        setConnectionState("disconnected", "Firebase disconnected");
      }

      refreshButtons();
    });
  } catch (error) {
    setConnectionState("error", "Firebase connection failed");
    setFeedback("The poll could not connect. Check firebase-config.js.");
    refreshButtons();
    console.error("Firebase poll initialization failed:", error);
  }

  async function submitVote(option) {
    const votingCode = normalizeVotingCode(codeInput.value);

    if (
      !optionKeys.includes(option) ||
      !isValidVotingCode(votingCode) ||
      submittedVote ||
      busy ||
      !connected ||
      !dataReady ||
      !votesReference
    ) {
      if (!isValidVotingCode(votingCode)) {
        updateCodeState(true);
        setFeedback("Enter a valid 6-20 character voting code first.");
      }
      return;
    }

    busy = true;
    refreshButtons();
    setFeedback("Recording your anonymous vote...");

    try {
      const voterId = await hashVotingCode(votingCode);
      const result = await votesReference.child(voterId).transaction(function (currentValue) {
        return currentValue === null ? option : undefined;
      });

      if (!result.committed) {
        const existingChoice = result.snapshot && result.snapshot.val();
        codeField.classList.remove("is-valid");
        codeField.classList.add("is-invalid");
        codeState.textContent = "Already used";
        setFeedback(
          existingChoice && optionDetails[existingChoice]
            ? "This voting code has already voted for " + optionDetails[existingChoice] + "."
            : "This voting code has already been used."
        );
        return;
      }

      submittedVote = option;
      submittedVoterId = voterId;
      writeStoredVote({
        option: option,
        voterId: voterId
      });
      codeInput.value = "";
      markSubmittedVote();
      updateCodeState();
      setFeedback("Thank you. Your vote for " + optionDetails[option] + " is now live.");
    } catch (error) {
      setFeedback("Your vote could not be recorded. Please try again.");
      console.error("Firebase poll vote failed:", error);
    } finally {
      busy = false;
      refreshButtons();
      exposeState();
    }
  }

  function aggregateVotes(value) {
    const nextCounts = { ...emptyCounts };

    Object.values(value || {}).forEach(function (choice) {
      if (optionKeys.includes(choice)) {
        nextCounts[choice] += 1;
      }
    });

    return nextCounts;
  }

  function normalizeVotingCode(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  }

  function isValidVotingCode(value) {
    return /^[A-Z0-9-]{6,20}$/.test(value);
  }

  async function hashVotingCode(value) {
    if (!window.crypto || !window.crypto.subtle || typeof window.TextEncoder !== "function") {
      throw new Error("Secure browser hashing is unavailable.");
    }

    const bytes = new window.TextEncoder().encode("nyc-living-priorities:v1:" + value);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest))
      .map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");

    return "v_" + hash;
  }

  function updateResults(nextCounts, animateChanges) {
    const total = optionKeys.reduce(function (sum, key) {
      return sum + nextCounts[key];
    }, 0);
    const leadingCount = Math.max.apply(
      null,
      optionKeys.map(function (key) {
        return nextCounts[key];
      })
    );

    totalElement.textContent = total.toLocaleString("en-US");
    totalLabel.textContent = total === 1 ? "total vote" : "total votes";

    resultGroups.forEach(function (group) {
      const key = group.dataset.pollResult;
      const count = nextCounts[key];
      const ratio = total > 0 ? count / total : 0;
      const percentage = total > 0 ? Math.round(ratio * 100) : 0;
      const tower = group.querySelector(".poll-tower");
      const countElement = group.querySelector("[data-poll-count]");
      const percentageElement = group.querySelector("[data-poll-percentage]");
      const previousCount = Number(group.dataset.previousCount || 0);
      const towerHeight = total > 0 ? Math.round(78 + ratio * 260) : 78;

      tower.style.setProperty("--tower-height", towerHeight + "px");
      countElement.textContent = count.toLocaleString("en-US");
      percentageElement.textContent = percentage + "%";
      group.classList.toggle("is-leading", total > 0 && count === leadingCount);

      if (animateChanges && count !== previousCount) {
        group.classList.remove("is-updating");
        window.requestAnimationFrame(function () {
          group.classList.add("is-updating");
          window.setTimeout(function () {
            group.classList.remove("is-updating");
          }, 540);
        });
      }

      group.dataset.previousCount = String(count);
    });

    skyline.setAttribute(
      "aria-label",
      "Live poll results. " +
        optionKeys
          .map(function (key) {
            return optionDetails[key] + ": " + nextCounts[key] + " votes";
          })
          .join(", ") +
        ". Total: " +
        total +
        " votes."
    );

    exposeState();
  }

  function markSubmittedVote() {
    buttons.forEach(function (button) {
      const selected = button.dataset.pollOption === submittedVote;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function updateCodeState(forceInvalid) {
    const votingCode = normalizeVotingCode(codeInput.value);
    const valid = isValidVotingCode(votingCode);

    codeField.classList.toggle("is-valid", !submittedVote && valid && !forceInvalid);
    codeField.classList.toggle("is-invalid", !submittedVote && Boolean(votingCode) && (!valid || forceInvalid));
    codeInput.disabled = Boolean(submittedVote);

    if (submittedVote) {
      codeState.textContent = "Vote saved";
      codeInput.placeholder = "Anonymous code registered";
    } else if (!votingCode) {
      codeState.textContent = "Required";
    } else if (valid && !forceInvalid) {
      codeState.textContent = "Ready";
    } else {
      codeState.textContent = "6-20 chars";
    }
  }

  function refreshButtons() {
    const validCode = isValidVotingCode(normalizeVotingCode(codeInput.value));
    const shouldDisable = busy || !connected || !dataReady || !validCode || Boolean(submittedVote);
    buttons.forEach(function (button) {
      button.disabled = shouldDisable;
    });
  }

  function setConnectionState(state, message) {
    connection.dataset.state = state;
    connectionText.textContent = message;
  }

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function hasValidFirebaseConfig(config) {
    const requiredFields = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
    return Boolean(
      config &&
        requiredFields.every(function (field) {
          const value = config[field];
          return typeof value === "string" && value.trim() && !value.includes("YOUR_");
        })
    );
  }

  function readStoredVote() {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey));
      return value &&
        optionKeys.includes(value.option) &&
        typeof value.voterId === "string" &&
        /^v_[a-f0-9]{64}$/.test(value.voterId)
        ? value
        : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredVote(value) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.warn("The browser could not store the local vote marker.");
    }
  }

  function exposeState() {
    window.engagementPoll = {
      getState: function () {
        return {
          connected: connected,
          dataReady: dataReady,
          busy: busy,
          submittedVote: submittedVote,
          hasAnonymousVoterId: Boolean(submittedVoterId),
          counts: { ...counts },
          total: optionKeys.reduce(function (sum, key) {
            return sum + counts[key];
          }, 0)
        };
      }
    };
  }
});
