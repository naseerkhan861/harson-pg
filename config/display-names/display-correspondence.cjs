"use strict";

/*
  Display-spelling correspondences (Appendix C of the 2026-09-29 runbook).

  Each entry maps a display spelling actually rendered by the provider UI
  to a CANONICAL SOURCE KEY in names.txt. Destinations are never repeated
  here: renaming a model means editing names.txt only, and every variant
  follows automatically.

  Matching policy:
  - Lookup keys are NFKC-normalized, trimmed, whitespace-collapsed and
    case-insensitive. "Pro"/"pro" and "GPT"/"gpt" therefore resolve
    through case normalization, per the runbook.
  - The four short Seedream version strings resolve ONLY inside the
    verified Seedream version-selector context (modelFamily "seedream",
    surface "model-version-tab"). They are never global aliases.
  - One-pass resolution: an alias is never fed back in as a source.
*/

const correspondences = {
  "FLUX.1 Kontext": "FLUX.1 Kontex (pro/max)",
  "FLUX.1Kontext": "FLUX.1 Kontex (pro/max)",
  "FLUXKrea": "FLUX Krea",
  "Kontext Pro": "FLUX.1 Kontext pro",
  "kontext-pro": "FLUX.1 Kontext pro",
  "Kontext Max": "FLUX.1 Kontext max",
  "kontext-max": "FLUX.1 Kontext max",
  "悠船Midjourney V7": "悠船MJ V7",
  "悠船 Midjourney V7": "悠船MJ V7",
  "悠船 MJ V7": "悠船MJ V7",
  "悠船M| V7": "悠船MJ V7",
  "悠船M｜ V7": "悠船MJ V7",
  "MidjourneyV7": "Midjourney V7",
  "即梦4.0": "即梦 4.0",
  "即梦4.5": "即梦 4.5",
  "即梦5.0 Lite": "即梦 5.0 Lite",
  "即梦5.0 Pro": "即梦 5.0 Pro",
  "全能图片Pro": "全能图片 Pro",
  "全能图片2": "全能图片 2",
  "HappyHorse": "Happy Horse",
  "GPT image 2": "GPT-image-2",
  "GPT image 2.5": "GPT-image-2.5",

  // Versioned Seedream display labels -> 即梦 canonical keys.
  "Seedream 4.0": "即梦 4.0",
  "Seedream 4.5": "即梦 4.5",
  "Seedream 5.0 Lite": "即梦 5.0 Lite",
  "Seedream 5.0 Pro": "即梦 5.0 Pro"
};

// Bare version strings, valid ONLY within the verified Seedream
// version-selector context (resolver enforces the context guard).
const seedreamVersionKeys = {
  "4.0": "即梦 4.0",
  "4.5": "即梦 4.5",
  "5.0 lite": "即梦 5.0 Lite",
  "5.0 pro": "即梦 5.0 Pro"
};

module.exports = {
  correspondences,
  seedreamVersionKeys
};
