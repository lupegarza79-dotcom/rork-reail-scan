// REAiL Extension – Content Script
// Injects a floating badge on every page showing verification status

(function () {
  if (document.getElementById("reail-badge")) return;

  const badge = document.createElement("div");
  badge.id = "reail-badge";
  badge.className = "reail-badge reail-badge--loading";
  badge.innerHTML = `<span class="reail-badge__icon">⏳</span><span class="reail-badge__label">Scanning…</span>`;
  badge.title = "REAiL Content Verification";
  document.body.appendChild(badge);

  badge.addEventListener("click", () => {
    badge.classList.toggle("reail-badge--expanded");
  });

  chrome.runtime.sendMessage(
    { type: "QUICK_SCAN", url: window.location.href },
    (result) => {
      if (chrome.runtime.lastError || !result) {
        setBadgeState("unknown", "Unknown", null, []);
        return;
      }
      if (result.error) {
        setBadgeState("unknown", "Error", null, []);
        return;
      }
      const b = result.badge || "UNKNOWN";
      const score = result.score;
      const flags = result.top_red_flags || [];
      setBadgeState(b, b.replace("_", " "), score, flags);
    }
  );

  function setBadgeState(badgeType, label, score, flags) {
    badge.className = `reail-badge reail-badge--${badgeType.toLowerCase()}`;
    const icon =
      badgeType === "VERIFIED" ? "✅" :
      badgeType === "HIGH_RISK" ? "🚨" :
      badgeType === "UNVERIFIED" ? "⚠️" : "❓";
    const scoreText = score !== null && score !== undefined ? ` (${score}/100)` : "";
    let flagsHtml = "";
    if (flags.length > 0) {
      flagsHtml = `<ul class="reail-badge__flags">${flags.map((f) => `<li>${f}</li>`).join("")}</ul>`;
    }
    badge.innerHTML =
      `<span class="reail-badge__icon">${icon}</span>` +
      `<span class="reail-badge__label">${label}${scoreText}</span>` +
      flagsHtml;
  }
})();
