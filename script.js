document.addEventListener("DOMContentLoaded", function() {
  const revealItems = document.querySelectorAll(".reveal");
  const storyPanels = Array.from(document.querySelectorAll("[data-story-panel]"));
  const storyIndex = document.querySelector("[data-story-index]");
  const storyTitle = document.querySelector("[data-story-title]");
  const root = document.documentElement;
  const storyHero = document.querySelector(".story-hero");
  let ticking = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function calculateStoryState(progress) {
    const compact = window.innerWidth < 760;
    const keyframes = compact
      ? [
          { x: 0, y: -154, scale: 0.72, blur: 0.2, opacity: 0.58 },
          { x: 0, y: -160, scale: 0.76, blur: 0.4, opacity: 0.62 },
          { x: 0, y: -166, scale: 0.7, blur: 0.7, opacity: 0.56 },
          { x: 0, y: -184, scale: 0.58, blur: 2.2, opacity: 0.42 }
        ]
      : [
          { x: 270, y: 0, scale: 1, blur: 0, opacity: 1 },
          { x: 245, y: 0, scale: 1.05, blur: 0.2, opacity: 1 },
          { x: -250, y: -8, scale: 0.94, blur: 0.4, opacity: 1 },
          { x: 0, y: -92, scale: 0.76, blur: 2.2, opacity: 0.74 }
        ];

    const scaled = clamp(progress, 0, 1) * (keyframes.length - 1);
    const index = Math.min(keyframes.length - 2, Math.floor(scaled));
    const local = scaled - index;
    const current = keyframes[index];
    const next = keyframes[index + 1];

    return {
      x: lerp(current.x, next.x, local),
      y: lerp(current.y, next.y, local),
      scale: lerp(current.scale, next.scale, local),
      blur: lerp(current.blur, next.blur, local),
      opacity: lerp(current.opacity, next.opacity, local)
    };
  }

  function updateStoryPanels(progress) {
    if (!storyPanels.length) {
      return;
    }

    const activeIndex = Math.min(storyPanels.length - 1, Math.floor(clamp(progress, 0, 0.999) * storyPanels.length));
    const activePanel = storyPanels[activeIndex];

    storyPanels.forEach(function(panel, index) {
      panel.classList.toggle("is-active", index === activeIndex);
      panel.classList.toggle("is-before", index < activeIndex);
    });

    if (activePanel && storyIndex && storyTitle) {
      storyIndex.textContent = `Scene ${activePanel.dataset.scene || String(activeIndex + 1).padStart(2, "0")}`;
      storyTitle.textContent = activePanel.dataset.sceneTitle || "";
    }
  }

  function updateScrollEffects() {
    ticking = false;

    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pageProgress = clamp(window.scrollY / maxScroll, 0, 1);
    let storyProgress = 0;

    if (storyHero) {
      const storyStart = storyHero.offsetTop;
      const storyLength = Math.max(1, storyHero.offsetHeight - window.innerHeight);
      storyProgress = clamp((window.scrollY - storyStart) / storyLength, 0, 1);
    }

    const storyState = calculateStoryState(storyProgress);
    const storyDrift = Math.round((storyProgress - 0.5) * 240);
    const storyGlowX = Math.round(storyState.x * 0.18);
    const storyGlowY = Math.round(storyState.y * 0.18);
    const depthOpacity = 0.26 + Math.sin(storyProgress * Math.PI) * 0.22;

    root.style.setProperty("--scroll-progress", pageProgress.toFixed(4));
    root.style.setProperty("--atmosphere-opacity", (0.42 + pageProgress * 0.26).toFixed(3));
    root.style.setProperty("--hero-glow-opacity", (0.38 + pageProgress * 0.18).toFixed(3));
    root.style.setProperty("--story-progress", storyProgress.toFixed(4));
    root.style.setProperty("--story-glow-opacity", (0.42 + storyProgress * 0.22).toFixed(3));
    root.style.setProperty("--story-glow-x", `${storyGlowX}px`);
    root.style.setProperty("--story-glow-y", `${storyGlowY}px`);
    root.style.setProperty("--story-logo-x", `${Math.round(storyState.x)}px`);
    root.style.setProperty("--story-logo-y", `${Math.round(storyState.y)}px`);
    root.style.setProperty("--story-logo-scale", storyState.scale.toFixed(4));
    root.style.setProperty("--story-logo-blur", `${storyState.blur.toFixed(2)}px`);
    root.style.setProperty("--story-logo-opacity", storyState.opacity.toFixed(3));
    root.style.setProperty("--story-drift", `${storyDrift}px`);
    root.style.setProperty("--story-drift-left", `${Math.round(storyDrift * -0.65)}px`);
    root.style.setProperty("--story-drift-right", `${Math.round(storyDrift * 0.75)}px`);
    root.style.setProperty("--story-drift-bottom", `${Math.round(storyDrift * -0.24)}px`);
    root.style.setProperty("--story-left-scale", (1 + storyProgress * 0.08).toFixed(3));
    root.style.setProperty("--story-right-scale", (1 + storyProgress * 0.12).toFixed(3));
    root.style.setProperty("--story-depth-opacity", depthOpacity.toFixed(3));
    root.style.setProperty("--story-depth-rotate", `${((storyProgress - 0.5) * 7).toFixed(2)}deg`);
    root.style.setProperty("--depth-line-one-x", `${Math.round(storyDrift * -0.12)}px`);
    root.style.setProperty("--depth-line-two-x", `${Math.round(storyDrift * 0.16)}px`);
    root.style.setProperty("--depth-line-three-x", `${Math.round(storyDrift * -0.1)}px`);
    root.style.setProperty("--atmosphere-shift", `${Math.round(pageProgress * -120)}px`);
    updateStoryPanels(storyProgress);
  }

  function requestScrollUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScrollEffects);
    }
  }

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach(function(item) {
      item.classList.add("is-visible");
    });
  } else {
    const observer = new IntersectionObserver(
      function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.22,
        rootMargin: "0px 0px -14% 0px"
      }
    );

    revealItems.forEach(function(item) {
      observer.observe(item);
    });
  }

  updateScrollEffects();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
});
