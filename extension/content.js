// REAiL Extension – Content Script
// Injects a floating badge on every page showing verification status

(function () {
  if (document.getElementById("reail-badge")) return;

  const badge = document.createElement("div");
  badge.id = "reail-badge";
  badge.className = "reail-badge reail-badge--loading";
  badge.innerHTML = `<span class="reail-badge__icon">🛡️</span><span class="reail-badge__label">Scanning…</span>`;
  badge.title = "REAiL Content Verification";
  document.body.appendChild(badge);

  let isExpanded = false;
  badge.addEventListener("click", () => {
    isExpanded = !isExpanded;
    badge.classList.toggle("reail-badge--expanded", isExpanded);
  });

  chrome.runtime.sendMessage(
    { type: "QUICK_SCAN", url: window.location.href },
    (result) => {
      if (chrome.runtime.lastError || !result) {
        setBadgeState("unknown", "Unknown", null, [], null);
        return;
      }
      if (result.error) {
        setBadgeState("unknown", "Setup Required", null, [], null);
        return;
      }
      const b = result.badge || "UNKNOWN";
      const score = result.score;
      const flags = result.top_red_flags || [];
      const scanId = result.scan_id || null;

      if (!b || b === "UNKNOWN") {
        setBadgeState("unknown", "No Data", null, [], null);
        return;
      }

      setBadgeState(b, b.replace("_", " "), score, flags, scanId);
    }
  );

  function setBadgeState(badgeType, label, score, flags, scanId) {
    const normalizedType = badgeType.toLowerCase();
    badge.className = `reail-badge reail-badge--${normalizedType}`;

    const icon =
      badgeType === "VERIFIED" ? "✅" :
      badgeType === "HIGH_RISK" ? "🚨" :
      badgeType === "UNVERIFIED" ? "⚠️" : "🛡️";

    const scoreText = score !== null && score !== undefined ? ` · ${score}/100` : "";

    let flagsHtml = "";
    if (flags.length > 0) {
      flagsHtml = `<ul class="reail-badge__flags">${flags.map((f) => `<li>${f}</li>`).join("")}</ul>`;
    }

    let reportLink = "";
    if (scanId) {
      reportLink = `<a class="reail-badge__report-link" href="https://reail.app/r/${scanId}" target="_blank" rel="noopener">View Full Report →</a>`;
    }

    badge.innerHTML =
      `<span class="reail-badge__icon">${icon}</span>` +
      `<span class="reail-badge__label">${label}${scoreText}</span>` +
      flagsHtml +
      reportLink;
  }
})();
