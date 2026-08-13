"use client";

export const COMPATIBILITY_MODES = {
  FULL: "full",
  REDUCED: "reduced",
  FALLBACK: "fallback",
};

const UNKNOWN_CAPABILITIES = {
  supportsRequestAnimationFrame: false,
  supportsIntersectionObserver: false,
  supportsResizeObserver: false,
  supportsSticky: false,
  supportsTransform3d: false,
  supportsBackdropFilter: false,
  supportsMaskImage: false,
  supportsModernViewportUnits: false,
  supportsAspectRatio: false,
  supportsVideoMP4: false,
  supportsVideoWebM: false,
  supportsTouch: false,
  supportsPointerEvents: false,
  prefersReducedMotion: false,
  saveData: false,
  deviceMemory: null,
  hardwareConcurrency: null,
};

function canUseCssSupports() {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function";
}

function supportsCss(property, value) {
  if (!canUseCssSupports()) return false;

  try {
    return CSS.supports(property, value);
  } catch {
    return false;
  }
}

function detectVideoSupport() {
  if (typeof document === "undefined") {
    return { supportsVideoMP4: false, supportsVideoWebM: false };
  }

  try {
    const video = document.createElement("video");
    const canPlay = typeof video.canPlayType === "function";

    if (!canPlay) {
      return { supportsVideoMP4: false, supportsVideoWebM: false };
    }

    const mp4Support = video.canPlayType('video/mp4; codecs="avc1.42E01E"');
    const webmSupport = video.canPlayType('video/webm; codecs="vp9"');

    return {
      supportsVideoMP4: mp4Support === "probably" || mp4Support === "maybe",
      supportsVideoWebM: webmSupport === "probably" || webmSupport === "maybe",
    };
  } catch {
    return { supportsVideoMP4: false, supportsVideoWebM: false };
  }
}

export function getUnknownCapabilities() {
  return { ...UNKNOWN_CAPABILITIES };
}

export function detectBrowserCapabilities() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return getUnknownCapabilities();
  }

  const navigatorLike = window.navigator || {};
  const connection =
    navigatorLike.connection || navigatorLike.mozConnection || navigatorLike.webkitConnection;

  const prefersReducedMotion =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const videoSupport = detectVideoSupport();

  return {
    supportsRequestAnimationFrame: typeof window.requestAnimationFrame === "function",
    supportsIntersectionObserver: "IntersectionObserver" in window,
    supportsResizeObserver: "ResizeObserver" in window,
    supportsSticky:
      supportsCss("position", "sticky") || supportsCss("position", "-webkit-sticky"),
    supportsTransform3d: supportsCss("transform", "translate3d(1px, 1px, 1px)"),
    supportsBackdropFilter:
      supportsCss("backdrop-filter", "blur(1px)") ||
      supportsCss("-webkit-backdrop-filter", "blur(1px)"),
    supportsMaskImage:
      supportsCss("mask-image", "linear-gradient(black, transparent)") ||
      supportsCss("-webkit-mask-image", "linear-gradient(black, transparent)"),
    supportsModernViewportUnits:
      supportsCss("height", "100svh") || supportsCss("height", "100dvh"),
    supportsAspectRatio: supportsCss("aspect-ratio", "16 / 9"),
    ...videoSupport,
    supportsTouch:
      "ontouchstart" in window ||
      (typeof navigatorLike.maxTouchPoints === "number" && navigatorLike.maxTouchPoints > 0),
    supportsPointerEvents: "PointerEvent" in window,
    prefersReducedMotion,
    saveData: Boolean(connection?.saveData),
    deviceMemory:
      typeof navigatorLike.deviceMemory === "number" ? navigatorLike.deviceMemory : null,
    hardwareConcurrency:
      typeof navigatorLike.hardwareConcurrency === "number"
        ? navigatorLike.hardwareConcurrency
        : null,
  };
}

export function classifyCompatibilityMode(capabilities) {
  const coreRuntimeChecks = [
    capabilities.supportsIntersectionObserver,
    capabilities.supportsSticky,
    capabilities.supportsTransform3d,
  ];
  const missingCoreCount = coreRuntimeChecks.filter((supported) => !supported).length;

  if (!capabilities.supportsRequestAnimationFrame || !capabilities.supportsVideoMP4) {
    return COMPATIBILITY_MODES.FALLBACK;
  }

  if (missingCoreCount >= 2) {
    return COMPATIBILITY_MODES.FALLBACK;
  }

  const constrainedHardware =
    (typeof capabilities.deviceMemory === "number" && capabilities.deviceMemory <= 2) ||
    (typeof capabilities.hardwareConcurrency === "number" &&
      capabilities.hardwareConcurrency <= 2);

  const enhancementChecks = [
    capabilities.supportsResizeObserver,
    capabilities.supportsBackdropFilter,
    capabilities.supportsMaskImage,
    capabilities.supportsModernViewportUnits,
    capabilities.supportsAspectRatio,
    capabilities.supportsVideoWebM,
    capabilities.supportsPointerEvents,
  ];
  const missingEnhancementCount = enhancementChecks.filter((supported) => !supported).length;

  if (
    capabilities.prefersReducedMotion ||
    capabilities.saveData ||
    constrainedHardware ||
    missingCoreCount === 1 ||
    missingEnhancementCount >= 3
  ) {
    return COMPATIBILITY_MODES.REDUCED;
  }

  return COMPATIBILITY_MODES.FULL;
}
