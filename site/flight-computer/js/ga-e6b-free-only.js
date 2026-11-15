/* Lock the E6-B on Free use. Other modes stay in the trainer code but
   cannot be opened from the UI. Zoom / size (#e6b-zoom, pinch, wheel)
   is unchanged. */
(function () {
  "use strict";

  var LOCK_SEL = "#practice, #quiz, #list-tutorial, #list-options, #resume-tutorial, .link-tutorial, .full-screen, .practiceType, .quizType";
  var MODALS = ["practiceModal", "quizModal", "scoreModal", "modal_interactive", "practice-popup", "quiz-popup"];

  function isFreeLabel(text) {
    return /free\s*use|simulation/i.test(text || "");
  }

  function closeModals() {
    MODALS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.classList.remove("show", "in", "fade");
    });
  }

  function goFree() {
    closeModals();
    var md = document.getElementById("mode-display");
    if (md && isFreeLabel(md.textContent)) return;
    var display = document.getElementById("display");
    if (!display) return;
    try {
      if (window.jQuery) window.jQuery("#display").click();
      else display.click();
    } catch (e) {}
    if (md && !isFreeLabel(md.textContent)) md.textContent = "Free use";
  }

  function blocked(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(LOCK_SEL);
  }

  function onPointer(e) {
    if (!blocked(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    goFree();
  }

  document.addEventListener("click", onPointer, true);
  document.addEventListener("pointerdown", onPointer, true);
  document.addEventListener("touchstart", onPointer, true);

  var watching = false;
  function watch() {
    if (watching) return;
    watching = true;
    goFree();
    var md = document.getElementById("mode-display");
    if (md) {
      new MutationObserver(function () {
        if (md && !isFreeLabel(md.textContent)) goFree();
      }).observe(md, { childList: true, characterData: true, subtree: true });
    }
  }

  function boot() { watch(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 200); });
  } else {
    setTimeout(boot, 200);
  }
  window.addEventListener("load", function () {
    setTimeout(goFree, 400);
    setTimeout(goFree, 1200);
  });
})();
