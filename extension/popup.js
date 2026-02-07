// REAiL Extension – Popup Script

document.addEventListener("DOMContentLoaded", async () => {
  const resultEl = document.getElementById("result");
  const flagsContainer = document.getElementById("flags-container");
  const flagsEl = document.getElementById("flags");
  const actionsEl = document.getElementById("actions");
  const fullReportLink = document.getElementById("fullReportLink");
  const rescanBtn = document.getElementById("rescanBtn");
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
    showResult("unknown", "Not Available", null, null, []);
    return;
  }

  const currentUrl = tab.url;
  let currentDomain = "";
  try {
    currentDomain = new URL(currentUrl).hostname;
  } catch {}

  function doScan() {
    showLoading();
    chrome.runtime.sendMessage({ type: "QUICK_SCAN", url: currentUrl }, (data) => {
      if (chrome.runtime.lastError || !data) {
        showError("Could not connect to REAiL. Check your settings.");
        return;
      }
      if (data.error) {
        showError(data.error);
        return;
      }

      const badge = data.badge || null;
      const score = data.score;
      const flags = data.top_red_flags || [];
      const scanId = data.scan_id || null;
      const domain = data.domain || currentDomain;

      if (!badge && !score) {
        showNoResult(domain);
        return;
      }

      showResult(
        badge ? badge.toLowerCase() : "unknown",
        badge ? badge.replace("_", " ") : "Unknown",
        score,
        domain,
        flags
      );

      if (scanId) {
        fullReportLink.href = `https://reail.app/r/${scanId}`;
        actionsEl.style.display = "flex";
      } else {
        actionsEl.style.display = "none";
      }
    });
  }

  doScan();

  rescanBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_CACHE", url: currentUrl });
    doScan();
  });

  function showLoading() {
    resultEl.innerHTML = `
      <div class="badge-display loading">
        <div class="badge-icon-wrap"><span class="spinner"></span></div>
        <div class="badge-info">
          <div class="badge-label">Scanning...</div>
          <div class="badge-score">Analyzing ${currentDomain || "page"}</div>
        </div>
      </div>`;
    flagsContainer.style.display = "none";
    actionsEl.style.display = "none";
  }

  function showResult(cls, label, score, domain, flags) {
    const icon =
      cls === "verified" ? "✅" :
      cls === "high_risk" ? "🚨" :
      cls === "unverified" ? "⚠️" : "❓";
    const scoreText = score !== null && score !== undefined ? `Risk Score: ${score}/100` : "";

    resultEl.innerHTML = `
      <div class="badge-display ${cls}">
        <div class="badge-icon-wrap">${icon}</div>
        <div class="badge-info">
          <div class="badge-label">${label}</div>
          <div class="badge-score">${scoreText}</div>
          ${domain ? `<div class="badge-domain">${domain}</div>` : ""}
        </div>
      </div>`;

    if (flags && flags.length > 0) {
      flagsEl.innerHTML = flags.map((f) => `<li>${f}</li>`).join("");
      flagsContainer.style.display = "block";
    } else {
      flagsContainer.style.display = "none";
    }
  }

  function showNoResult(domain) {
    resultEl.innerHTML = `
      <div class="no-result-msg">
        No previous scan found for <strong>${domain || "this page"}</strong>.<br/>
        Run a full scan from the REAiL app for detailed analysis.
      </div>`;
    flagsContainer.style.display = "none";
    actionsEl.style.display = "none";
  }

  function showError(msg) {
    resultEl.innerHTML = `<div class="error-msg">${msg}</div>`;
    flagsContainer.style.display = "none";
    actionsEl.style.display = "none";
  }
});
