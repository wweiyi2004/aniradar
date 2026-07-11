export { normalizeUrl, computeSignalHash, computeContentHash } from "./hash";
export { buildEventFromSignal, MIN_PUBLIC_CONFIDENCE } from "./event";
export type { BuildEventInput, BuiltEvent } from "./event";
export {
  extractWorkTitle,
  titleSimilarity,
  isSameEvent,
  categoriesCompatible,
  compatibleCategories,
} from "./merge";
export type { EventLike } from "./merge";
