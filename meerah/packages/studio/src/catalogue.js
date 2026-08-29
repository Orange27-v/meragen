import {
  t2iModels, t2vModels, i2iModels, i2vModels,
  v2vModels, lipsyncModels, recastModels, audioModels,
} from "./models.js";

/**
 * Every model this UI can actually drive, with the job it does.
 *
 * The server prices models by id and knows nothing about their names or the
 * controls they accept — that lives here, in the catalogue the studios already
 * load. Joining the two is what lets the Advanced picker show a human name
 * beside a real Naira price without either side learning the other's business.
 *
 * Grouped by what a customer is trying to make, not by the vendor's taxonomy:
 * "Image to Video" is a job, "Lora Support" is not.
 */
const GROUPS = [
  ["Text to Video", t2vModels],
  ["Image to Video", i2vModels],
  ["Text to Image", t2iModels],
  ["Image to Image", i2iModels],
  ["Video to Video", v2vModels],
  ["Lip sync", lipsyncModels],
  ["Audio", audioModels],
  ["Recast", recastModels],
];

let cached = null;

/** `[{ id, name, group }]`, one entry per model, first group wins on a tie. */
export function modelCatalogue() {
  if (cached) return cached;
  const seen = new Map();
  for (const [group, list] of GROUPS) {
    for (const model of list || []) {
      if (!model?.id || seen.has(model.id)) continue;
      seen.set(model.id, { id: model.id, name: model.name || model.id, group });
    }
  }
  cached = [...seen.values()];
  return cached;
}
