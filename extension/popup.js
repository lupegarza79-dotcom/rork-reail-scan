// REAiL Extension – Popup Script

document.addEventListener("DOMContentLoaded", async () => {
  const resultEl = document.getElementById("result");
  const flagsEl = document.getElementById("flags");
  const apiBaseInput = document.getElementById("apiBase");
  const anonKeyInput = document.getElementById("anonKey");
  const saveBtn = document.getElementById("save");
  const saveStatus = document.getElementById("saveStatus");

  const config = await chrome.storage.sync.get(["apiBase", "anonKey"]);
  apiBaseInput.value = config.apiBase || "";
  anonKeyInput.value = config.anonKey || "";

  saveBtn.addEventListener("click", async () => {
    await chrome.storage.sync.set({
      apiBase: apiBaseInput.value.trim(),
      anonKey: anonKeyInput.value.trim(),
    });
    saveStatus.textContent = "Saved ✓";
    setTimeout(() => (saveStatus.textContent = ""), 2000);
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith("http")) {
    showResult("unknown", "N/A", null, []);
    return;
  }

  chrome.runtime.sendMessage({ type: "QUICK_SCAN", url: tab.url }, (data) => {
    if (chrome.runtime.lastError || !data) {
      showResult("unknown", "Error", null, []);
      return;
    }
    const badge = data.badge || "UNKNOWN";
    showResult(
      badge.toLowerCase(),
      badge.replace("_", " "),
      data.score,
      data.top_red_flags || []
    );
  });

  function showResult(cls, label, score, flags) {
    const icon =
      cls === "verified" ? "✅" :
      cls === "high_risk" ? "🚨" :
      cls === "unverified" ? "⚠️" : "❓";
    const scoreText = score !== null && score !== undefined ? `Score: ${score}/100` : "";
    resultEl.innerHTML = `
      <div class="badge-display ${cls}">
        <span class="badge-icon">${icon}</span>
        <div class="badge-info">
          <div class="badge-label">${label}</div>
          <div class="badge-score">${scoreText}</div>
        </div>
      </div>`;
    flagsEl.innerHTML = flags.map((f) => `<li>⚠ ${f}</li>`).join("");
  }
});
