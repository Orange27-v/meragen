"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useId } from "react";
import toast, { Toaster } from "react-hot-toast";
import { generateVideo, generateI2V, processV2V, uploadFile, getUserBalance } from "../muapi.js";
import { formatErrorMessage } from "../utils/formatError.js";
import { scopedPersistKey, migrateLegacyPersistKey } from "../persistKey.js";
import DrawModal from "./DrawModal.jsx";
import ModelParameterControls from "./ModelParameterControls.jsx";
import MobileGenerationActions, { GenerationCopyButtons } from "./MobileGenerationActions.jsx";
import {
  t2vModels,
  getAspectRatiosForVideoModel,
  getDurationsForModel,
  getResolutionsForVideoModel,
  getAspectRatiosForI2VModel,
  getDurationsForI2VModel,
  getResolutionsForI2VModel,
  getEffectsForI2VModel,
  getDefaultEffectForI2VModel,
} from "../models.js";
import {
  getFamilyVariant,
  videoModelCatalog,
  videoModelPickerEntries,
  videoModelPickerEntryByVariantId,
} from "../modelFamilies.js";
import {
  SettingsRail,
  RailTabs,
  RailSegmented,
  RailSection,
  RailCard,
  RailCardTitle,
  RailRow,
  RailInlineRow,
  RailPillRow,
  RailPill,
  RailChip,
  Collapsible,
  OptionRow,
  RailWell,
  ClockIcon,
  FrameIcon,
  GemIcon,
  EqualiserIcon,
  AtIcon,
  PencilIcon,
} from "./rail/SettingsRail";
import { QualityPicker, useQualityTiers } from "./rail/QualityPicker";
import { QualityPoster } from "./rail/QualityPoster";
import { WorkTabs } from "./rail/WorkTabs";
import { CostMeter } from "./rail/CostMeter";
import {
  buildReferenceParams,
  getModelMediaCapabilities,
  recordGenerationSource,
  shouldDisableVideoPrompt,
} from "../modelCapabilities.js";
import {
  buildSupplementalInputPayload,
  createModelParameterValues,
  getSupplementalModelInputs,
} from "../modelParameters.js";
import {
  appendVideoWorkflowMedia,
  buildVideoWorkflowMediaParams,
  getVideoWorkflowDraftKey,
  getVideoWorkflowFamily,
  getVideoWorkflowMediaConfig,
  getVideoWorkflowMediaSlots,
  getVideoWorkflowSlotRemaining,
  inferVideoWorkflowId,
  legacyVideoMediaToWorkflowDraft,
  projectVideoWorkflowMedia,
  removeVideoWorkflowMedia,
  resolvePersistedVideoWorkflowSelection,
  resolveVideoBaseVariant,
  resolveVideoWorkflowVariant,
  validateVideoWorkflowMedia,
} from "../videoWorkflows.js";
import {
  PROMPT_MEDIA_PREVIEW_CLASS,
  PromptMenuItem,
  PromptMenuList,
  PromptPopover,
  PromptPopoverHeader,
  PromptTextarea,
  promptMediaButtonClassName,
} from "./prompt/PromptComposer.jsx";

async function downloadFile(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

function mergeReferenceUrls(current, incoming, limit) {
  return [...new Set([...current, ...incoming])].slice(0, limit);
}

const EMPTY_WORKFLOW_MEDIA_DRAFT = Object.freeze({});

/**
 * The six workflows, grouped into the three things a customer comes here to do.
 *
 * The grouping is the tab bar across the top of the rail. A workflow missing
 * from every group would be unreachable, so anything added to
 * `VIDEO_WORKFLOW_IDS` belongs in one of these lists too.
 */
/**
 * Where a pill's menu opens.
 *
 * Upward, because the pills sit near the bottom of the rail and a menu below
 * them would open off the panel. The last pill in a row anchors right so a
 * 210px menu on a 90px pill stays inside the rail instead of over the canvas.
 */
const POPOVER_ABOVE_LEFT = "absolute bottom-[calc(100%+8px)] left-0 z-50";
const POPOVER_ABOVE_RIGHT = "absolute bottom-[calc(100%+8px)] right-0 z-50";

const WORKFLOW_BASE_ID = "__base";
const WORKFLOW_TABS = Object.freeze([
  {
    id: "create",
    label: "Create Video",
    workflows: ["animate_image", "keyframes", "references"],
  },
  {
    id: "edit",
    label: "Edit Video",
    workflows: ["edit_video", "extend_uploaded_video"],
  },
  {
    id: "motion",
    label: "Motion Control",
    workflows: ["motion_transfer"],
  },
]);

function workflowContextKey(familyId, workflowId) {
  return `${familyId}:${workflowId || "base"}`;
}

function isSameSelection(left, right) {
  return (
    left?.selectedFamilyId === right?.selectedFamilyId &&
    left?.selectedModel === right?.selectedModel &&
    left?.selectedWorkflowId === right?.selectedWorkflowId
  );
}

function ReferenceMediaLabel({ label, required = false }) {
  if (!label) return null;
  return (
    <span
      className={`flex min-h-6 max-w-[88px] items-start justify-center text-balance text-center text-[10px] font-semibold leading-3 ${
        required ? "text-[var(--steel)]" : "text-[color-mix(in_srgb,var(--chalk)_45%,transparent)]"
      }`}
    >
      {label}
      {required && (
        <span className="ml-0.5 text-[var(--chalk)]" aria-hidden="true">
          *
        </span>
      )}
    </span>
  );
}

function ReferencePreview({ type, url, index, onRemove, label = null, description = null }) {
  const mediaLabel = label || (type === "image" ? "image" : type === "video" ? "video" : "audio");
  const actionLabel = description || mediaLabel;
  return (
    <div className="flex min-w-[60px] flex-col items-center gap-1.5">
      <div className={PROMPT_MEDIA_PREVIEW_CLASS}>
        {type === "image" ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : type === "video" ? (
          <video src={url} className="w-full h-full object-cover" muted />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--sunk)] text-[var(--lilac)]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M9 18V5l10-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="16" cy="16" r="3" />
            </svg>
          </div>
        )}
        <button
          type="button"
          aria-label={`Remove ${actionLabel.toLowerCase()}`}
          title={`Remove ${actionLabel.toLowerCase()}`}
          onClick={() => onRemove(index)}
          className="absolute top-0.5 right-0.5 w-4 h-4 bg-[var(--surface)] hover:bg-[var(--surface)] rounded-full flex items-center justify-center text-[color-mix(in_srgb,var(--chalk)_85%,transparent)] hover:text-[var(--chalk)] text-[8px] border border-[var(--line)]"
        >
          ×
        </button>
      </div>
      <ReferenceMediaLabel label={mediaLabel} />
    </div>
  );
}

function ReferenceUploadButton({
  inputRef,
  accept,
  multiple,
  onChange,
  onClick,
  title,
  uploading,
  progress,
  type,
  label = null,
  required = false,
  disabled = false,
}) {
  const localInputRef = useRef(null);
  const resolvedInputRef = inputRef || localInputRef;
  const announcedProgress = Math.min(100, Math.max(0, Math.floor(progress / 10) * 10));
  return (
    <div
      className={label ? "relative flex min-w-[60px] flex-col items-center gap-1.5" : "relative"}
    >
      <input
        ref={resolvedInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-busy={uploading || undefined}
        disabled={disabled}
        onClick={onClick || (() => resolvedInputRef.current?.click())}
        className={`${promptMediaButtonClassName()} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {uploading ? (
          <div className="flex flex-col items-center justify-center w-full h-full absolute inset-0 bg-[var(--veil)] z-20 backdrop-blur-[2px]">
            <svg className="w-8 h-8 -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                className="text-[var(--ash)]"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                strokeDasharray={88}
                strokeDashoffset={88 - (88 * progress) / 100}
                className="text-[var(--chalk)] transition-all duration-300"
              />
            </svg>
            <span className="absolute text-[9px] font-black text-[var(--chalk)] leading-none">
              {progress}%
            </span>
          </div>
        ) : type === "video" ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-[var(--fog)] group-hover:text-[var(--chalk)] transition-colors"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ) : type === "audio" ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-[var(--fog)] group-hover:text-[var(--chalk)] transition-colors"
          >
            <path d="M9 18V5l10-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="16" cy="16" r="3" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-[var(--fog)] group-hover:text-[var(--chalk)] transition-colors"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {uploading ? `${title}: ${announcedProgress}% uploaded` : ""}
      </span>
      <ReferenceMediaLabel label={label} required={required} />
    </div>
  );
}

// ── SVG icons (kept inline to avoid extra deps) ───────────────────────────────

const CheckSvg = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="4">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const VideoIconSvg = ({ className }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const VideoReadySvg = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="text-[var(--lilac)]"
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    <polyline points="7 10 10 13 15 8" stroke="#22d3ee" strokeWidth="2.5" />
  </svg>
);

// ── Dropdown components ───────────────────────────────────────────────────────

const invertLogos = ["openai", "blackforest", "runway", "ideogram", "lightricks", "grok"];

// ── Control button ────────────────────────────────────────────────────────────

// ── Dropdown panel ─────────────────────────────────────────────────────────────
// Rendered inside a `relative` wrapper div; floats above the anchor button.

// ── Main component ────────────────────────────────────────────────────────────

export default function VideoStudio({
  apiKey,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  historyItems,
  onDeleteHistoryItem,
  droppedFiles,
  onFilesHandled,
}) {
  const LEGACY_PERSIST_KEY = "hg_video_studio_persistent";
  const PERSIST_KEY = scopedPersistKey(LEGACY_PERSIST_KEY, apiKey);
  useEffect(() => {
    migrateLegacyPersistKey(LEGACY_PERSIST_KEY, PERSIST_KEY);
  }, [PERSIST_KEY]);

  // ── generation state ──
  const [imageMode, setImageMode] = useState(false); // i2v
  const [v2vMode, setV2vMode] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  // ── model / params ──
  const defaultModel = t2vModels[0];
  const defaultFamily = videoModelCatalog.familyByVariantId.get(defaultModel.id);
  const [selectedModel, setSelectedModel] = useState(defaultModel.id);
  // Which quality is chosen, and what the account has to spend. Both drive the
  // cost meter pinned at the foot of the settings rail.
  const [selectedTierId, setSelectedTierId] = useState("draft");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState(defaultFamily.id);
  const [selectedAr, setSelectedAr] = useState(
    defaultModel.inputs?.aspect_ratio?.default || "16:9",
  );
  const [selectedDuration, setSelectedDuration] = useState(
    defaultModel.inputs?.duration?.default || 5,
  );
  const [selectedResolution, setSelectedResolution] = useState(
    defaultModel.inputs?.resolution?.default || "",
  );
  const [selectedQuality, setSelectedQuality] = useState(
    defaultModel.inputs?.quality?.default || "",
  );
  const [selectedEffect, setSelectedEffect] = useState("");
  const [modelParameterValues, setModelParameterValues] = useState(() =>
    createModelParameterValues(defaultModel),
  );

  // ── upload progress ──
  const [imageProgress, setImageProgress] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);

  // ── control visibility ──
  const [showAr, setShowAr] = useState(true);
  const [showDuration, setShowDuration] = useState(true);
  const [showResolution, setShowResolution] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showEffect, setShowEffect] = useState(false);

  // ── uploads ──
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedEndImageUrl, setUploadedEndImageUrl] = useState(null);
  const [endImageUploading, setEndImageUploading] = useState(false);
  const [endImageProgress, setEndImageProgress] = useState(0);
  const [uploadedVideoUrls, setUploadedVideoUrls] = useState([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadedAudioUrls, setUploadedAudioUrls] = useState([]);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [workflowMediaDrafts, setWorkflowMediaDrafts] = useState({});
  const [workflowUploadSlotId, setWorkflowUploadSlotId] = useState(null);
  const uploadedImageUrl = uploadedImageUrls[0] || null;
  const uploadedVideoUrl = uploadedVideoUrls[0] || null;

  // ── generation / canvas ──
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [fullscreenUrl, setFullscreenUrl] = useState(null);
  const [canvasUrl, setCanvasUrl] = useState(null);
  const [canvasModel, setCanvasModel] = useState(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);
  const [generationSources, setGenerationSources] = useState({});

  // ── history ──
  const [localHistory, setLocalHistory] = useState([]);
  const [activeHistoryIdx, setActiveHistoryIdx] = useState(0);

  // ── dropdown ──
  const [openDropdown, setOpenDropdown] = useState(null);

  // ── prompt ──
  const [prompt, setPrompt] = useState("");

  // ── refs ──
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const endImageFileInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  const audioFileInputRef = useRef(null);
  const resultVideoRef = useRef(null);
  const promptFieldId = `${useId()}-prompt`;
  const hasRestored = useRef(false);
  const selectionRef = useRef(null);
  selectionRef.current = {
    selectedFamilyId,
    selectedModel,
    selectedWorkflowId,
    imageMode,
    v2vMode,
  };
  const workflowVariantPreferencesRef = useRef(new Map());
  const workflowUploadSlotRef = useRef(null);
  const workflowDraftSessionRef = useRef(0);
  const mediaRef = useRef(null);
  mediaRef.current = {
    imageUrls: uploadedImageUrls,
    endImageUrl: uploadedEndImageUrl,
    videoUrls: uploadedVideoUrls,
    audioUrls: uploadedAudioUrls,
  };
  const workflowMediaDraftsRef = useRef(workflowMediaDrafts);
  workflowMediaDraftsRef.current = workflowMediaDrafts;

  // ── derived data ──
  const history = historyItems ?? localHistory;

  // See ImageStudio's handleDeleteEntry: when historyItems is server-backed
  // (White Label / backfilled sessions), localHistory isn't what's rendered,
  // so removal has to go through the parent to delete server-side and
  // update the same state `history` reads from.
  const handleDeleteEntry = useCallback(
    async (entry, idx) => {
      if (historyItems && onDeleteHistoryItem) {
        await onDeleteHistoryItem(entry);
      } else {
        setLocalHistory((prev) => prev.filter((_, i) => i !== idx));
      }
    },
    [historyItems, onDeleteHistoryItem],
  );

  const getCurrentAspectRatios = useCallback(
    (id) => (imageMode ? getAspectRatiosForI2VModel(id) : getAspectRatiosForVideoModel(id)),
    [imageMode],
  );

  const getCurrentDurations = useCallback(
    (id) => (imageMode ? getDurationsForI2VModel(id) : getDurationsForModel(id)),
    [imageMode],
  );

  const getCurrentResolutions = useCallback(
    (id) => (imageMode ? getResolutionsForI2VModel(id) : getResolutionsForVideoModel(id)),
    [imageMode],
  );

  const getCurrentModel = useCallback(
    () => videoModelCatalog.variantById.get(selectedModel)?.model,
    [selectedModel],
  );

  const isMotionControlSelection = useCallback((modelId, isV2v) => {
    if (!isV2v) return false;
    const m = videoModelCatalog.variantById.get(modelId)?.model;
    return !!m?.imageField;
  }, []);

  // ── update controls when the selected model changes ─────────────────────
  const applyControlsForModel = useCallback((modelId, isImageMode, isV2vMode) => {
    if (isV2vMode) {
      setShowAr(false);
      setShowDuration(false);
      setShowResolution(false);
      setShowQuality(false);
      setShowEffect(false);
      return;
    }

    const model = videoModelCatalog.variantById.get(modelId)?.model;

    const ars = isImageMode
      ? getAspectRatiosForI2VModel(modelId)
      : getAspectRatiosForVideoModel(modelId);
    if (ars.length > 0) {
      setSelectedAr(ars[0]);
      setShowAr(true);
    } else {
      setShowAr(false);
    }

    const durations = isImageMode
      ? getDurationsForI2VModel(modelId)
      : getDurationsForModel(modelId);
    if (durations.length > 0) {
      setSelectedDuration(model?.inputs?.duration?.default ?? durations[0]);
      setShowDuration(true);
    } else {
      setShowDuration(false);
    }

    const resolutions = isImageMode
      ? getResolutionsForI2VModel(modelId)
      : getResolutionsForVideoModel(modelId);
    if (resolutions.length > 0) {
      setSelectedResolution(resolutions[0]);
      setShowResolution(true);
    } else {
      setShowResolution(false);
    }

    const qualities = model?.inputs?.quality?.enum || [];
    if (qualities.length > 0) {
      setSelectedQuality(model?.inputs?.quality?.default || qualities[0]);
      setShowQuality(true);
    } else {
      setSelectedQuality("");
      setShowQuality(false);
    }

    const effects = isImageMode ? getEffectsForI2VModel(modelId) : [];
    if (effects.length > 0) {
      setSelectedEffect(getDefaultEffectForI2VModel(modelId) || effects[0]);
      setShowEffect(true);
    } else {
      setSelectedEffect("");
      setShowEffect(false);
    }
  }, []);

  const selectedFamily = videoModelCatalog.familyById.get(selectedFamilyId) || defaultFamily;
  const currentFamilyMode = v2vMode ? "v2v" : imageMode ? "i2v" : "t2v";
  const workflowFamily = getVideoWorkflowFamily(selectedFamilyId);

  // ── the rail's three places ──────────────────────────────────────────────
  //
  // The six workflows answer three different questions — am I making footage,
  // changing footage I have, or driving a character with footage — and the rail
  // is a different instrument in each case. They were previously one dropdown
  // labelled "Source", which put "Animate Image" and "Motion Transfer" in the
  // same list as if they were alternatives.
  //
  // The tab is *derived* from the chosen workflow rather than held in state, so
  // there is no second source of truth to fall out of step when the model
  // changes underneath it.
  const availableWorkflowIds = new Set(
    (workflowFamily?.workflows || []).map((workflow) => workflow.id),
  );
  const railTabs = WORKFLOW_TABS.map((tab) => ({
    ...tab,
    available: tab.workflows.filter((id) => availableWorkflowIds.has(id)),
  })).filter((tab) =>
    tab.id === "create"
      ? workflowFamily?.hasBase || tab.available.length > 0
      : tab.available.length > 0,
  );
  const activeTabId =
    railTabs.find((tab) => tab.available.includes(selectedWorkflowId))?.id ?? "create";
  const activeTab = railTabs.find((tab) => tab.id === activeTabId) ?? null;
  const segmentOptions = [
    // Base generation is a real choice on this tab, not the absence of one, so
    // it gets a segment with a name rather than being"whatever is left".
    ...(activeTabId === "create" && workflowFamily?.hasBase
      ? [{ id: WORKFLOW_BASE_ID, label: "Text to Video" }]
      : []),
    ...(activeTab?.available || []).map((id) => ({
      id,
      label: workflowFamily?.workflowById.get(id)?.label || id,
    })),
  ];
  const workflowMediaDraftKey = selectedWorkflowId
    ? getVideoWorkflowDraftKey(selectedFamilyId, selectedWorkflowId)
    : null;
  const selectedVariant = videoModelCatalog.variantById.get(selectedModel);
  const selectedPickerEntry = videoModelPickerEntryByVariantId.get(selectedModel);
  const activeWorkflowMediaDraft = useMemo(
    () =>
      workflowMediaDraftKey
        ? projectVideoWorkflowMedia(
            selectedVariant?.model,
            selectedWorkflowId,
            workflowMediaDrafts[workflowMediaDraftKey] || EMPTY_WORKFLOW_MEDIA_DRAFT,
          )
        : null,
    [selectedVariant, selectedWorkflowId, workflowMediaDraftKey, workflowMediaDrafts],
  );
  const promptDisabled = shouldDisableVideoPrompt(selectedVariant?.model, currentFamilyMode);
  const workflowMediaSlots = useMemo(
    () =>
      selectedWorkflowId
        ? getVideoWorkflowMediaSlots(selectedVariant?.model, selectedWorkflowId)
        : [],
    [selectedVariant, selectedWorkflowId],
  );
  const currentModelCapabilities = getModelMediaCapabilities(selectedVariant?.model);
  const supplementalInputs = getSupplementalModelInputs(selectedVariant?.model);

  const applySelectedVariant = useCallback(
    (variant, mode, family, workflowId = null) => {
      const model = variant.model;
      const nextV2VMode = mode === "v2v";
      const nextImageMode = mode === "i2v";

      const previous = selectionRef.current;
      if (previous?.selectedFamilyId && previous?.selectedModel) {
        workflowVariantPreferencesRef.current.set(
          workflowContextKey(previous.selectedFamilyId, previous.selectedWorkflowId),
          previous.selectedModel,
        );
      }
      workflowVariantPreferencesRef.current.set(
        workflowContextKey(family.id, workflowId),
        model.id,
      );

      selectionRef.current = {
        selectedFamilyId: family.id,
        selectedModel: model.id,
        selectedWorkflowId: workflowId,
        imageMode: nextImageMode,
        v2vMode: nextV2VMode,
      };
      setSelectedFamilyId(family.id);
      setSelectedModel(model.id);
      setSelectedWorkflowId(workflowId);
      setModelParameterValues((values) => createModelParameterValues(model, values));
      setV2vMode(nextV2VMode);
      setImageMode(nextImageMode);
      applyControlsForModel(model.id, nextImageMode, nextV2VMode);
    },
    [applyControlsForModel],
  );

  const reconcileReferencesForModel = useCallback((model) => {
    const capabilities = getModelMediaCapabilities(model);
    setUploadedImageUrls((urls) => urls.slice(0, capabilities.image.maxItems));
    setUploadedVideoUrls((urls) => urls.slice(0, capabilities.video.maxItems));
    setUploadedAudioUrls((urls) => urls.slice(0, capabilities.audio.maxItems));
    if (!capabilities.image.separateLastItem) setUploadedEndImageUrl(null);
  }, []);

  const applyUserSelectedVariant = useCallback(
    (variant, mode, family, workflowId = null) => {
      if (workflowId) {
        const draftKey = getVideoWorkflowDraftKey(family.id, workflowId);
        setWorkflowMediaDrafts((drafts) => {
          if (drafts[draftKey]) return drafts;
          return {
            ...drafts,
            [draftKey]: legacyVideoMediaToWorkflowDraft(
              variant.model,
              workflowId,
              mediaRef.current,
            ),
          };
        });
      } else {
        reconcileReferencesForModel(variant.model);
      }
      if (shouldDisableVideoPrompt(variant.model, mode)) {
        setPrompt("");
      }
      applySelectedVariant(variant, mode, family, workflowId);
    },
    [applySelectedVariant, reconcileReferencesForModel],
  );

  // ── Persistence: Load ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        let restoredMode = data.v2vMode ? "v2v" : data.imageMode ? "i2v" : "t2v";
        let restoredModelId = data.selectedModel || defaultModel.id;
        let restoredWorkflowId = null;
        let restoredModel = defaultModel;
        let restoredFamilyId = defaultFamily.id;
        if (data.selectedModel) {
          const restored = resolvePersistedVideoWorkflowSelection(
            data.selectedModel,
            data.selectedWorkflowId || null,
            { hasEndFrame: Boolean(data.uploadedEndImageUrl) },
          );
          if (restored.family && restored.variant) {
            restoredModelId = restored.variant.model.id;
            restoredMode = restored.variant.mode;
            restoredWorkflowId = restored.workflowId;
            restoredModel = restored.variant.model;
            restoredFamilyId = restored.family.id;
            setSelectedModel(restoredModelId);
            setSelectedFamilyId(restored.family.id);
            setSelectedWorkflowId(restored.workflowId);
            setModelParameterValues(
              createModelParameterValues(restored.variant.model, data.modelParameterValues || {}),
            );
          }
        }
        setImageMode(restoredMode === "i2v");
        setV2vMode(restoredMode === "v2v");
        if (data.selectedAr) setSelectedAr(data.selectedAr);
        if (data.selectedDuration) setSelectedDuration(data.selectedDuration);
        if (data.selectedResolution) setSelectedResolution(data.selectedResolution);
        if (data.selectedQuality) setSelectedQuality(data.selectedQuality);
        if (data.selectedEffect) setSelectedEffect(data.selectedEffect);
        if (data.uploadedImageUrls) {
          setUploadedImageUrls(data.uploadedImageUrls);
        } else if (data.uploadedImageUrl) {
          setUploadedImageUrls([data.uploadedImageUrl]);
        }
        if (data.uploadedEndImageUrl) setUploadedEndImageUrl(data.uploadedEndImageUrl);
        if (data.uploadedVideoUrls) {
          setUploadedVideoUrls(data.uploadedVideoUrls);
        } else if (data.uploadedVideoUrl) {
          setUploadedVideoUrls([data.uploadedVideoUrl]);
        }
        if (data.uploadedAudioUrls) setUploadedAudioUrls(data.uploadedAudioUrls);
        const persistedDrafts =
          data.workflowMediaDrafts && typeof data.workflowMediaDrafts === "object"
            ? { ...data.workflowMediaDrafts }
            : {};
        if (restoredWorkflowId) {
          const draftKey = getVideoWorkflowDraftKey(restoredFamilyId, restoredWorkflowId);
          if (!persistedDrafts[draftKey]) {
            persistedDrafts[draftKey] = legacyVideoMediaToWorkflowDraft(
              restoredModel,
              restoredWorkflowId,
              {
                imageUrls:
                  data.uploadedImageUrls || (data.uploadedImageUrl ? [data.uploadedImageUrl] : []),
                endImageUrl: data.uploadedEndImageUrl || null,
                videoUrls:
                  data.uploadedVideoUrls || (data.uploadedVideoUrl ? [data.uploadedVideoUrl] : []),
                audioUrls: data.uploadedAudioUrls || [],
              },
            );
          }
        }
        setWorkflowMediaDrafts(persistedDrafts);
        if (data.prompt) setPrompt(data.prompt);
        if (data.localHistory) setLocalHistory(data.localHistory);

        // Update control visibility based on restored model/mode
        applyControlsForModel(restoredModelId, restoredMode === "i2v", restoredMode === "v2v");
      }
    } catch (err) {
      console.warn("Failed to load VideoStudio persistence:", err);
    } finally {
      hasRestored.current = true;
    }
  }, [applyControlsForModel, defaultModel.id]);

  // ── Persistence: Save ────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const state = {
          imageMode,
          v2vMode,
          selectedWorkflowId,
          selectedModel,
          selectedFamilyId,
          selectedAr,
          selectedDuration,
          selectedResolution,
          selectedQuality,
          selectedEffect,
          modelParameterValues,
          uploadedImageUrls,
          uploadedEndImageUrl,
          uploadedVideoUrls,
          uploadedAudioUrls,
          workflowMediaDrafts,
          prompt,
          localHistory,
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("Failed to save VideoStudio persistence:", err);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [
    imageMode,
    v2vMode,
    selectedWorkflowId,
    selectedModel,
    selectedFamilyId,
    selectedAr,
    selectedDuration,
    selectedResolution,
    selectedQuality,
    selectedEffect,
    modelParameterValues,
    uploadedImageUrls,
    uploadedEndImageUrl,
    uploadedVideoUrls,
    uploadedAudioUrls,
    workflowMediaDrafts,
    prompt,
    localHistory,
  ]);

  // ── Derived UI values ────────────────────────────────────────────────────

  const resolveMediaTarget = useCallback((mediaType) => {
    const selection = selectionRef.current;
    const family = videoModelCatalog.familyById.get(selection.selectedFamilyId);
    const currentVariant = videoModelCatalog.variantById.get(selection.selectedModel);
    const currentCapabilities = getModelMediaCapabilities(currentVariant?.model);
    if (currentCapabilities[mediaType].maxItems > 0) {
      return {
        family,
        mode: selection.v2vMode ? "v2v" : selection.imageMode ? "i2v" : "t2v",
        variant: currentVariant,
      };
    }

    // Families with explicit workflows never switch endpoints because a file
    // was uploaded. The user chooses the workflow first.
    if (getVideoWorkflowFamily(family?.id)) return null;

    const targetMode = mediaType === "image" ? "i2v" : mediaType === "video" ? "v2v" : null;
    if (!targetMode || !family?.supports[targetMode]) return null;
    const variant = getFamilyVariant(
      videoModelCatalog,
      family,
      targetMode,
      selection.selectedModel,
    );
    return variant ? { family, mode: targetMode, variant } : null;
  }, []);

  const applyReferenceUrls = useCallback(
    (mediaType, urls, target = null, selectionAtStart = null) => {
      const validUrls = urls.filter(Boolean);
      if (validUrls.length === 0) return;
      if (selectionAtStart && !isSameSelection(selectionAtStart, selectionRef.current)) {
        toast.error("The model changed during upload. Please add the file again.");
        return;
      }
      const resolvedTarget = target || resolveMediaTarget(mediaType);
      if (!resolvedTarget) {
        const family = videoModelCatalog.familyById.get(selectionRef.current.selectedFamilyId);
        toast.error(`${family.name} does not support ${mediaType} references.`);
        return;
      }

      const isCurrentVariant =
        resolvedTarget.variant.model.id === selectionRef.current.selectedModel;
      if (!isCurrentVariant) {
        reconcileReferencesForModel(resolvedTarget.variant.model);
        applySelectedVariant(resolvedTarget.variant, resolvedTarget.mode, resolvedTarget.family);
      }

      const activeWorkflowId = selectionRef.current.selectedWorkflowId;
      const workflowConfig = activeWorkflowId
        ? getVideoWorkflowMediaConfig(resolvedTarget.variant.model, activeWorkflowId)
        : null;
      const limit = workflowConfig
        ? mediaType === "image"
          ? workflowConfig.imageLimit
          : mediaType === "video"
            ? workflowConfig.videoLimit
            : workflowConfig.audioLimit
        : getModelMediaCapabilities(resolvedTarget.variant.model)[mediaType].maxItems;
      const setter =
        mediaType === "image"
          ? setUploadedImageUrls
          : mediaType === "video"
            ? setUploadedVideoUrls
            : setUploadedAudioUrls;
      setter((current) => mergeReferenceUrls(current, validUrls, limit));
    },
    [applySelectedVariant, reconcileReferencesForModel, resolveMediaTarget],
  );

  const handleDrawReference = useCallback(
    (entry) => {
      if (!selectedWorkflowId) {
        applyReferenceUrls("image", [entry?.url]);
        return;
      }
      const slot = workflowMediaSlots.find((item) => {
        return (
          item.mediaType === "image" &&
          item.acceptDrop !== false &&
          getVideoWorkflowSlotRemaining(item, activeWorkflowMediaDraft) > 0
        );
      });
      if (!slot || !workflowMediaDraftKey || !entry?.url) {
        toast.error("The selected source does not accept images.");
        return;
      }
      setWorkflowMediaDrafts((drafts) => {
        const draft = drafts[workflowMediaDraftKey] || {};
        const activeDraft = projectVideoWorkflowMedia(
          selectedVariant?.model,
          selectedWorkflowId,
          draft,
        );
        return appendVideoWorkflowMedia(
          drafts,
          workflowMediaDraftKey,
          slot,
          [entry.url],
          activeDraft,
        );
      });
    },
    [
      activeWorkflowMediaDraft,
      applyReferenceUrls,
      selectedWorkflowId,
      selectedVariant,
      workflowMediaDraftKey,
      workflowMediaSlots,
    ],
  );

  const uploadFiles = useCallback(
    async (files, { label, maxBytes, setUploading, setProgress }) => {
      const selectedFiles = Array.from(files);
      const tooLarge = selectedFiles.find((file) => file.size > maxBytes);
      if (tooLarge) {
        alert(`${label} exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit.`);
        return [];
      }
      setUploading(true);
      setProgress(0);
      try {
        const progress = new Array(selectedFiles.length).fill(0);
        return await Promise.all(
          selectedFiles.map((file, index) =>
            uploadFile(apiKey, file, (value) => {
              progress[index] = value;
              setProgress(
                Math.round(progress.reduce((sum, item) => sum + item, 0) / progress.length),
              );
            }),
          ),
        );
      } catch (err) {
        console.error(`[VideoStudio] ${label} upload failed:`, err);
        alert(`${label} upload failed: ${err.message}`);
        return [];
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [apiKey],
  );

  const uploadWorkflowSlotFiles = useCallback(
    async (draftKey, slot, files, context = null) => {
      if (!draftKey || !slot || workflowUploadSlotRef.current) return;
      const selectionAtStart = context?.selection || { ...selectionRef.current };
      const targetModel = videoModelCatalog.variantById.get(selectionAtStart.selectedModel)?.model;
      const workflowIdAtStart = selectionAtStart.selectedWorkflowId;
      const draftSession = context?.session ?? workflowDraftSessionRef.current;
      const currentDraft = workflowMediaDraftsRef.current[draftKey] || {};
      const activeDraft = projectVideoWorkflowMedia(targetModel, workflowIdAtStart, currentDraft);
      const remaining = getVideoWorkflowSlotRemaining(slot, activeDraft);
      if (remaining === 0) return;

      const selectedFiles = Array.from(files).slice(0, remaining);
      if (selectedFiles.length === 0) return;
      const options =
        slot.mediaType === "image"
          ? {
              label: slot.label,
              maxBytes: 10 * 1024 * 1024,
              setUploading: setImageUploading,
              setProgress: setImageProgress,
            }
          : slot.mediaType === "video"
            ? {
                label: slot.label,
                maxBytes: 50 * 1024 * 1024,
                setUploading: setVideoUploading,
                setProgress: setVideoProgress,
              }
            : {
                label: slot.label,
                maxBytes: 50 * 1024 * 1024,
                setUploading: setAudioUploading,
                setProgress: setAudioProgress,
              };

      const uploadKey = `${draftKey}:${slot.id}`;
      workflowUploadSlotRef.current = uploadKey;
      setWorkflowUploadSlotId(uploadKey);
      try {
        const urls = await uploadFiles(selectedFiles, options);
        if (urls.length > 0 && draftSession === workflowDraftSessionRef.current) {
          const latestDraft = workflowMediaDraftsRef.current[draftKey] || {};
          const latestActiveDraft = projectVideoWorkflowMedia(
            targetModel,
            workflowIdAtStart,
            latestDraft,
          );
          const nextDrafts = appendVideoWorkflowMedia(
            workflowMediaDraftsRef.current,
            draftKey,
            slot,
            urls,
            latestActiveDraft,
          );
          workflowMediaDraftsRef.current = nextDrafts;
          setWorkflowMediaDrafts(nextDrafts);
        }
      } finally {
        workflowUploadSlotRef.current = null;
        setWorkflowUploadSlotId(null);
      }
    },
    [uploadFiles],
  );

  const uploadDroppedWorkflowFiles = useCallback(
    async (files) => {
      if (!workflowMediaDraftKey) return;
      const dropSession = workflowDraftSessionRef.current;
      const dropSelection = { ...selectionRef.current };
      const dropModel = videoModelCatalog.variantById.get(dropSelection.selectedModel)?.model;
      const remainingFiles = Array.from(files);
      for (const slot of workflowMediaSlots) {
        if (dropSession !== workflowDraftSessionRef.current) break;
        if (slot.acceptDrop === false) continue;
        const matching = remainingFiles.filter((file) =>
          file.type.startsWith(`${slot.mediaType}/`),
        );
        if (matching.length === 0) continue;
        const currentDraft = workflowMediaDraftsRef.current[workflowMediaDraftKey] || {};
        const activeDraft = projectVideoWorkflowMedia(
          dropModel,
          dropSelection.selectedWorkflowId,
          currentDraft,
        );
        const capacity = getVideoWorkflowSlotRemaining(slot, activeDraft);
        if (capacity === 0) continue;
        const batch = matching.slice(0, capacity);
        await uploadWorkflowSlotFiles(workflowMediaDraftKey, slot, batch, {
          selection: dropSelection,
          session: dropSession,
        });
        if (dropSession !== workflowDraftSessionRef.current) break;
        for (const file of batch) {
          const index = remainingFiles.indexOf(file);
          if (index >= 0) remainingFiles.splice(index, 1);
        }
      }
    },
    [uploadWorkflowSlotFiles, workflowMediaDraftKey, workflowMediaSlots],
  );

  const removeWorkflowMedia = useCallback(
    (slotId, index) => {
      if (!workflowMediaDraftKey) return;
      setWorkflowMediaDrafts((drafts) =>
        removeVideoWorkflowMedia(drafts, workflowMediaDraftKey, slotId, index),
      );
    },
    [workflowMediaDraftKey],
  );

  const uploadReferences = useCallback(
    async (mediaType, files) => {
      const selectionAtStart = { ...selectionRef.current };
      const target = resolveMediaTarget(mediaType);
      if (!target) {
        const family = videoModelCatalog.familyById.get(selectionRef.current.selectedFamilyId);
        toast.error(`${family.name} does not support ${mediaType} references.`);
        return;
      }
      const capability = getModelMediaCapabilities(target.variant.model)[mediaType];
      const workflowConfig = selectionAtStart.selectedWorkflowId
        ? getVideoWorkflowMediaConfig(target.variant.model, selectionAtStart.selectedWorkflowId)
        : null;
      const currentUrls =
        mediaType === "image"
          ? mediaRef.current.imageUrls
          : mediaType === "video"
            ? mediaRef.current.videoUrls
            : mediaRef.current.audioUrls;
      const configuredLimit = workflowConfig
        ? mediaType === "image"
          ? workflowConfig.imageLimit
          : mediaType === "video"
            ? workflowConfig.videoLimit
            : workflowConfig.audioLimit
        : capability.maxItems;
      const mainLimit =
        mediaType === "image" && (capability.separateLastItem || workflowConfig?.separateEndImage)
          ? Math.min(configuredLimit, 1)
          : configuredLimit;
      const remaining = Math.max(mainLimit - currentUrls.length, 0);
      if (remaining === 0) return;

      const options =
        mediaType === "image"
          ? {
              label: "Image",
              maxBytes: 10 * 1024 * 1024,
              setUploading: setImageUploading,
              setProgress: setImageProgress,
            }
          : mediaType === "video"
            ? {
                label: "Video",
                maxBytes: 50 * 1024 * 1024,
                setUploading: setVideoUploading,
                setProgress: setVideoProgress,
              }
            : {
                label: "Audio",
                maxBytes: 50 * 1024 * 1024,
                setUploading: setAudioUploading,
                setProgress: setAudioProgress,
              };
      const urls = await uploadFiles(Array.from(files).slice(0, remaining), options);
      applyReferenceUrls(mediaType, urls, target, selectionAtStart);
    },
    [applyReferenceUrls, resolveMediaTarget, uploadFiles],
  );

  // ── Handle Dropped Files ────────────────────────────────────────────────
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      if (selectedWorkflowId) {
        if (workflowUploadSlotRef.current) {
          toast.error("Wait for the current upload to finish, then add these files again.");
          onFilesHandled?.();
          return;
        }
        void uploadDroppedWorkflowFiles(droppedFiles);
        onFilesHandled?.();
        return;
      }
      const imageFiles = droppedFiles.filter((f) => f.type.startsWith("image/"));
      const videoFiles = droppedFiles.filter((f) => f.type.startsWith("video/"));
      const audioFiles = droppedFiles.filter((f) => f.type.startsWith("audio/"));

      if (videoFiles.length > 0) {
        uploadReferences("video", videoFiles);
      } else if (imageFiles.length > 0) {
        uploadReferences("image", imageFiles);
      } else if (audioFiles.length > 0) {
        uploadReferences("audio", audioFiles);
      }
      onFilesHandled?.();
    }
  }, [
    droppedFiles,
    onFilesHandled,
    selectedWorkflowId,
    uploadDroppedWorkflowFiles,
    uploadReferences,
  ]);

  // Initialise controls for default model on mount
  useEffect(() => {
    if (hasRestored.current) return;
    applyControlsForModel(defaultModel.id, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [openDropdown]);

  const handlePromptInput = (e) => {
    setPrompt(e.target.value);
  };

  // ── image upload ─────────────────────────────────────────────────────────
  const handleImageFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    try {
      await uploadReferences("image", files);
    } finally {
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  };

  const removeImageAtIndex = (idx) => {
    const nextUrls = uploadedImageUrls.filter((_, i) => i !== idx);
    setUploadedImageUrls(nextUrls);
    if (nextUrls.length === 0) {
      if (workflowFamily) return;
      if (isMotionControlSelection(selectedModel, v2vMode)) return;
      if (currentFamilyMode === "t2v" && currentModelCapabilities.image.maxItems > 0) return;
      const family = videoModelCatalog.familyById.get(selectedFamilyId);
      const target = getFamilyVariant(videoModelCatalog, family, "t2v", selectedModel);
      if (target) applyUserSelectedVariant(target, "t2v", family);
    }
  };

  // ── end-frame upload (FLF i2v models) ──────────────────────────────────────
  const handleEndImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Image exceeds 10MB limit.");
      return;
    }
    setEndImageUploading(true);
    setEndImageProgress(0);
    const selectionAtStart = { ...selectionRef.current };
    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setEndImageProgress(pct);
      });
      const latestModel = videoModelCatalog.variantById.get(
        selectionRef.current.selectedModel,
      )?.model;
      if (
        isSameSelection(selectionAtStart, selectionRef.current) &&
        (selectionRef.current.selectedWorkflowId === "keyframes" ||
          getModelMediaCapabilities(latestModel).image.separateLastItem)
      ) {
        setUploadedEndImageUrl(url);
      }
    } catch (err) {
      alert(`End frame upload failed: ${err.message}`);
    } finally {
      setEndImageUploading(false);
      setEndImageProgress(0);
      if (endImageFileInputRef.current) endImageFileInputRef.current.value = "";
    }
  };

  const clearEndImage = () => setUploadedEndImageUrl(null);

  // ── video upload ─────────────────────────────────────────────────────────
  const handleVideoFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    try {
      await uploadReferences("video", files);
    } finally {
      if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    }
  };

  const removeVideoAtIndex = (index) => {
    const nextUrls = uploadedVideoUrls.filter((_, itemIndex) => itemIndex !== index);
    setUploadedVideoUrls(nextUrls);
    if (workflowFamily) return;
    if (nextUrls.length > 0 || currentFamilyMode !== "v2v") return;
    const family = videoModelCatalog.familyById.get(selectedFamilyId);
    const target = getFamilyVariant(videoModelCatalog, family, "t2v", selectedModel);
    if (target) applyUserSelectedVariant(target, "t2v", family);
  };

  const handleAudioFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    try {
      await uploadReferences("audio", files);
    } finally {
      if (audioFileInputRef.current) audioFileInputRef.current.value = "";
    }
  };

  const removeAudioAtIndex = (index) => {
    setUploadedAudioUrls((urls) => urls.filter((_, itemIndex) => itemIndex !== index));
  };

  // ── model selection from dropdown ─────────────────────────────────────────
  const handleModelSelect = useCallback(
    (pickerEntry, category = "all") => {
      const { family, variantsByMode, defaultVariant } = pickerEntry;
      const target =
        category !== "all"
          ? variantsByMode[category]
          : variantsByMode[currentFamilyMode] || defaultVariant;
      if (!target) return;

      const targetWorkflowFamily = getVideoWorkflowFamily(family.id);
      if (targetWorkflowFamily) {
        const workflowId =
          targetWorkflowFamily.base.variantIds.has(target.model.id) ||
          targetWorkflowFamily.unmanagedVariantIds.has(target.model.id)
            ? null
            : inferVideoWorkflowId(family.id, target.model.id);
        applyUserSelectedVariant(target, target.mode, family, workflowId);
        return;
      }

      applyUserSelectedVariant(target, target.mode, family);
    },
    [applyUserSelectedVariant, currentFamilyMode],
  );

  // The price list, and the tier currently chosen from it.
  const qualityTiers = useQualityTiers("video");
  const selectedTier = qualityTiers.find((tier) => tier.tierId === selectedTierId) || null;

  // The balance the cost meter subtracts from. Refreshed after every job,
  // because a generation is the thing that moves it.
  const refreshBalance = useCallback(() => {
    getUserBalance(apiKey)
      .then((result) => setCreditBalance(result.balance))
      .catch(() => {});
  }, [apiKey]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // Buying credits belongs to the shell, which owns the sheet and can show it
  // over any page. The studio only has to say that it is needed.
  const openTopUp = useCallback(() => {
    window.dispatchEvent(new CustomEvent("meerah:buy-credits"));
  }, []);

  // ── quality selection ─────────────────────────────────────────────────────
  //
  // A tier names an exact vendor model, and the server only honours the tier
  // price when that exact id is submitted. So this resolves the pinned variant
  // itself rather than going through handleModelSelect, which picks the best
  // variant in a family and could land on a neighbour at a different price.
  const handleTierSelect = useCallback(
    (tier) => {
      const entry = videoModelCatalog.variantById.get(tier.modelId);
      if (!entry) return;
      setSelectedTierId(tier.tierId);
      applyUserSelectedVariant(entry, entry.mode, entry.family ?? selectedFamily);
    },
    [applyUserSelectedVariant, selectedFamily],
  );

  const handleWorkflowSelect = useCallback(
    (workflowId) => {
      const preferred = workflowVariantPreferencesRef.current.get(
        workflowContextKey(selectedFamilyId, workflowId),
      );
      const target = resolveVideoWorkflowVariant(
        selectedFamilyId,
        workflowId,
        selectedModel,
        preferred,
      );
      if (target) {
        applyUserSelectedVariant(target, target.mode, selectedFamily, workflowId);
      }
    },
    [applyUserSelectedVariant, selectedFamily, selectedFamilyId, selectedModel],
  );

  const clearWorkflow = useCallback(() => {
    const preferred = workflowVariantPreferencesRef.current.get(
      workflowContextKey(selectedFamilyId, null),
    );
    const target = resolveVideoBaseVariant(selectedFamilyId, selectedModel, preferred);
    if (target) applyUserSelectedVariant(target, target.mode, selectedFamily, null);
  }, [applyUserSelectedVariant, selectedFamily, selectedFamilyId, selectedModel]);

  /**
   * A model chosen in the picker drawer.
   *
   * The drawer hands back a variant id, and a variant id alone is not a
   * selection: the family, the mode, the model's own parameters and the
   * workflow all follow from it. Setting `selectedModel` on its own — which is
   * what this used to do — left the rail showing one model's name over another
   * model's family, so picking Wan 2.7 Video Edit from Seedance kept Seedance's
   * workflows.
   */
  const applyPickedModel = useCallback(
    (variantId) => {
      const variant = videoModelCatalog.variantById.get(variantId);
      const family = videoModelCatalog.familyByVariantId.get(variantId);
      if (!variant || !family) {
        setSelectedModel(variantId);
        return;
      }
      const targetWorkflowFamily = getVideoWorkflowFamily(family.id);
      const workflowId =
        !targetWorkflowFamily ||
        targetWorkflowFamily.base.variantIds.has(variantId) ||
        targetWorkflowFamily.unmanagedVariantIds.has(variantId)
          ? null
          : inferVideoWorkflowId(family.id, variantId);
      applyUserSelectedVariant(variant, variant.mode, family, workflowId);
    },
    [applyUserSelectedVariant],
  );

  // The picker drawer lives in the app shell, so the Model row asks by event
  // and the choice comes back as one. The listener is on the studio rather than
  // inside the quality dialog, which exists only while that dialog is open —
  // the rail's Model row can be pressed at any time.
  useEffect(() => {
    const picked = (event) => {
      const id = event.detail?.modelId;
      if (id) applyPickedModel(id);
    };
    window.addEventListener("meerah:model-picked", picked);
    return () => window.removeEventListener("meerah:model-picked", picked);
  }, [applyPickedModel]);

  /** A segment is a workflow, except the one that means"no workflow". */
  const handleSegmentSelect = useCallback(
    (id) => {
      if (id === WORKFLOW_BASE_ID) clearWorkflow();
      else handleWorkflowSelect(id);
    },
    [clearWorkflow, handleWorkflowSelect],
  );

  /**
   * Moving to a tab lands on its first workflow, because a tab with nothing
   * selected under it would be a place you can stand where the rail does
   * nothing. Create Video prefers base generation when the family has it.
   */
  const handleRailTabSelect = useCallback(
    (tabId, tabs) => {
      const tab = tabs.find((candidate) => candidate.id === tabId);
      if (!tab) return;
      if (tab.id === "create" && workflowFamily?.hasBase) {
        clearWorkflow();
        return;
      }
      if (tab.available.length > 0) handleWorkflowSelect(tab.available[0]);
    },
    [clearWorkflow, handleWorkflowSelect, workflowFamily],
  );

  // ── add to local history ──────────────────────────────────────────────────
  const addToLocalHistory = useCallback((entry) => {
    setLocalHistory((prev) => [entry, ...prev].slice(0, 30));
    setActiveHistoryIdx(0);
  }, []);

  // ── show result in canvas ─────────────────────────────────────────────────
  const showVideoInCanvas = useCallback((url, model) => {
    setCanvasUrl(url);
    setCanvasModel(model);
    setShowCanvas(true);
  }, []);

  // ── generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const currentModel = getCurrentModel();
    const isExtendMode = currentModel?.requiresRequestId;
    const capabilities = getModelMediaCapabilities(currentModel);
    const requestSource = generationSources[selectedFamily.id];
    const trimmedPrompt = prompt.trim();
    const workflowMedia = selectedWorkflowId
      ? activeWorkflowMediaDraft || {}
      : {
          imageUrls: uploadedImageUrls,
          endImageUrl: uploadedEndImageUrl,
          videoUrls: uploadedVideoUrls,
          audioUrls: uploadedAudioUrls,
        };

    if (!selectedWorkflowId && uploadedVideoUrls.length > 0 && capabilities.video.maxItems === 0) {
      alert(`$VidEngine does not support video references.`);
      return;
    }
    if (!selectedWorkflowId && uploadedImageUrls.length > 0 && capabilities.image.maxItems === 0) {
      alert(`$VidEngine does not support image references.`);
      return;
    }
    if (!selectedWorkflowId && uploadedAudioUrls.length > 0 && capabilities.audio.maxItems === 0) {
      alert(`$VidEngine does not support audio references.`);
      return;
    }
    if (currentModel?.promptRequired && !trimmedPrompt) {
      alert("Please enter a prompt for this model.");
      return;
    }

    if (selectedWorkflowId) {
      const validation = validateVideoWorkflowMedia(
        selectedWorkflowId,
        workflowMedia,
        currentModel,
      );
      if (!validation.valid) {
        alert(validation.message);
        return;
      }
    } else if (v2vMode) {
      if (!uploadedVideoUrl) {
        alert("Please upload a video first.");
        return;
      }
      if (currentModel?.imageField && !uploadedImageUrl) {
        alert("Please upload a reference image for motion control.");
        return;
      }
    } else if (isExtendMode) {
      if (!requestSource?.requestId) {
        alert(`No $VidEngine generation found to continue.`);
        return;
      }
    } else if (imageMode) {
      if (uploadedImageUrls.length === 0) {
        alert("Please upload at least one reference image first.");
        return;
      }
    } else {
      if (!trimmedPrompt) {
        alert("Please enter a prompt to generate a video.");
        return;
      }
    }

    onGenerationStart?.();
    setGenerating(true);
    setGenerateError(null);

    try {
      let res;
      const referenceParams = selectedWorkflowId
        ? buildVideoWorkflowMediaParams(currentModel, selectedWorkflowId, workflowMedia)
        : buildReferenceParams(currentModel, workflowMedia);

      if (v2vMode) {
        // V2V: dedicated processV2V handles single-input tools (e.g. watermark
        // remover) and motion-control models (which take video + image + prompt)
        const v2vParams = {
          model: selectedModel,
          ...buildSupplementalInputPayload(currentModel, modelParameterValues),
          ...referenceParams,
        };
        if (currentModel?.hasPrompt && trimmedPrompt) {
          v2vParams.prompt = trimmedPrompt;
        }
        res = await processV2V(apiKey, v2vParams);
        if (!res?.url) throw new Error("No video URL returned by API");

        const genId = res.id || Date.now().toString();
        const entry = {
          id: genId,
          url: res.url,
          prompt: currentModel?.hasPrompt ? trimmedPrompt : "",
          // The card shows this. A vendor id here would publish our supplier
          // list, and means nothing to someone who chose "Draft".
          model: selectedTier?.label || "Video",
          timestamp: new Date().toISOString(),
        };
        addToLocalHistory(entry);
        refreshBalance();
        showVideoInCanvas(res.url, selectedModel);
        if (onGenerationComplete)
          onGenerationComplete({
            url: res.url,
            model: selectedModel,
            prompt: currentModel?.hasPrompt ? trimmedPrompt : "",
            type: "video",
          });
      } else if (imageMode) {
        const i2vParams = {
          model: selectedModel,
          ...buildSupplementalInputPayload(currentModel, modelParameterValues),
          ...referenceParams,
        };
        if (trimmedPrompt) i2vParams.prompt = trimmedPrompt;
        i2vParams.aspect_ratio = selectedAr;
        const durations = getDurationsForI2VModel(selectedModel);
        if (durations.length > 0) i2vParams.duration = selectedDuration;
        const resolutions = getResolutionsForI2VModel(selectedModel);
        if (resolutions.length > 0) i2vParams.resolution = selectedResolution;
        if (selectedQuality) i2vParams.quality = selectedQuality;
        if (showEffect && selectedEffect) i2vParams.name = selectedEffect;

        res = await generateI2V(apiKey, i2vParams);
        if (!res?.url) throw new Error("No video URL returned by API");

        const genId = res.id || Date.now().toString();
        setGenerationSources((sources) =>
          recordGenerationSource(sources, selectedFamily.id, genId, selectedModel),
        );
        const entry = {
          id: genId,
          url: res.url,
          prompt: trimmedPrompt,
          // The card shows this. A vendor id here would publish our supplier
          // list, and means nothing to someone who chose "Draft".
          model: selectedTier?.label || "Video",
          aspect_ratio: selectedAr,
          duration: selectedDuration,
          timestamp: new Date().toISOString(),
        };
        addToLocalHistory(entry);
        refreshBalance();
        showVideoInCanvas(res.url, selectedModel);
        if (onGenerationComplete)
          onGenerationComplete({
            url: res.url,
            model: selectedModel,
            prompt: trimmedPrompt,
            type: "video",
          });
      } else {
        // T2V (including extend mode)
        const params = {
          model: selectedModel,
          ...buildSupplementalInputPayload(currentModel, modelParameterValues),
          ...referenceParams,
        };
        if (trimmedPrompt) params.prompt = trimmedPrompt;

        if (isExtendMode) {
          params.request_id = requestSource.requestId;
        } else {
          params.aspect_ratio = selectedAr;
        }

        const durations = getDurationsForModel(selectedModel);
        if (durations.length > 0) params.duration = selectedDuration;
        const resolutions = getResolutionsForVideoModel(selectedModel);
        if (resolutions.length > 0) params.resolution = selectedResolution;
        if (selectedQuality) params.quality = selectedQuality;

        res = await generateVideo(apiKey, params);
        if (!res?.url) throw new Error("No video URL returned by API");

        const genId = res.id || Date.now().toString();
        setGenerationSources((sources) =>
          recordGenerationSource(sources, selectedFamily.id, genId, selectedModel),
        );
        const entry = {
          id: genId,
          url: res.url,
          prompt: trimmedPrompt,
          // The card shows this. A vendor id here would publish our supplier
          // list, and means nothing to someone who chose "Draft".
          model: selectedTier?.label || "Video",
          aspect_ratio: selectedAr,
          duration: selectedDuration,
          timestamp: new Date().toISOString(),
        };
        addToLocalHistory(entry);
        refreshBalance();
        showVideoInCanvas(res.url, selectedModel);
        if (onGenerationComplete)
          onGenerationComplete({
            url: res.url,
            model: selectedModel,
            prompt: trimmedPrompt,
            type: "video",
          });
      }
    } catch (e) {
      console.error("[VideoStudio]", e);
      const errMsg = formatErrorMessage(e, "Video generation failed");
      if (onGenerationError) onGenerationError(errMsg);
      else toast.error(errMsg);
    } finally {
      setGenerating(false);
      onGenerationEnd?.();
    }
  }, [
    apiKey,
    prompt,
    v2vMode,
    imageMode,
    selectedWorkflowId,
    selectedModel,
    selectedFamily,
    selectedAr,
    selectedDuration,
    selectedResolution,
    selectedQuality,
    selectedEffect,
    modelParameterValues,
    showEffect,
    uploadedImageUrls,
    uploadedEndImageUrl,
    uploadedVideoUrls,
    uploadedAudioUrls,
    activeWorkflowMediaDraft,
    generationSources,
    getCurrentModel,
    addToLocalHistory,
    showVideoInCanvas,
    onGenerationComplete,
    onGenerationEnd,
    onGenerationError,
    onGenerationStart,
  ]);

  // ── reset to prompt bar ───────────────────────────────────────────────────
  const resetToPromptBar = useCallback(() => {
    setShowCanvas(false);
  }, []);

  const handleNewPrompt = useCallback(() => {
    resetToPromptBar();
    setPrompt("");
    setUploadedImageUrls([]);
    setUploadedEndImageUrl(null);
    setUploadedVideoUrls([]);
    setUploadedAudioUrls([]);
    workflowDraftSessionRef.current += 1;
    setWorkflowMediaDrafts({});
    const first = t2vModels[0];
    const family = videoModelCatalog.familyByVariantId.get(first.id);
    const variant = videoModelCatalog.variantById.get(first.id);
    applyUserSelectedVariant(variant, "t2v", family);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [applyUserSelectedVariant, resetToPromptBar]);

  const handleExtend = useCallback(
    (requestId, sourceModelId) => {
      if (!requestId) return;
      resetToPromptBar();
      setPrompt("");
      setUploadedImageUrls([]);
      setUploadedEndImageUrl(null);
      setUploadedVideoUrls([]);
      setUploadedAudioUrls([]);
      const family = videoModelCatalog.familyById.get("seedance-2");
      const target = videoModelCatalog.variantById.get("seedance-2-extend");
      setGenerationSources((sources) =>
        recordGenerationSource(sources, family.id, requestId, sourceModelId),
      );
      applyUserSelectedVariant(target, "t2v", family);
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    [applyUserSelectedVariant, resetToPromptBar],
  );

  // ── derived UI values ────────────────────────────────────────────────────
  const isSeedance2Canvas =
    videoModelCatalog.familyByVariantId.get(canvasModel)?.id === "seedance-2";
  const currentModelObj = selectedVariant?.model;
  const isExtendMode = currentModelObj?.requiresRequestId;
  const isMotionControlModel = isMotionControlSelection(selectedModel, v2vMode);
  const workflowMediaConfig = selectedWorkflowId
    ? getVideoWorkflowMediaConfig(currentModelObj, selectedWorkflowId)
    : null;
  const canUploadImageReference = workflowMediaConfig
    ? workflowMediaConfig.imageLimit > 0
    : workflowFamily
      ? currentModelCapabilities.image.maxItems > 0
      : currentModelCapabilities.image.maxItems > 0 || (!v2vMode && selectedFamily.supports.i2v);
  // Whether this model takes any media at all — governs the upload section.
  const canStartFromMedia =
    canUploadImageReference ||
    currentModelCapabilities.video.maxItems > 0 ||
    currentModelCapabilities.audio.maxItems > 0;

  const imageTargetVariant = workflowFamily
    ? selectedVariant
    : currentModelCapabilities.image.maxItems > 0
      ? selectedVariant
      : getFamilyVariant(videoModelCatalog, selectedFamily, "i2v", selectedModel);
  const imageUploadCapability = getModelMediaCapabilities(imageTargetVariant?.model).image;
  const imageUploadLimit = workflowMediaConfig
    ? workflowMediaConfig.imageLimit
    : imageUploadCapability.separateLastItem
      ? 1
      : imageUploadCapability.maxItems;
  const videoTargetVariant = workflowFamily
    ? selectedVariant
    : currentModelCapabilities.video.maxItems > 0
      ? selectedVariant
      : getFamilyVariant(videoModelCatalog, selectedFamily, "v2v", selectedModel);
  const videoUploadLimit = workflowMediaConfig
    ? workflowMediaConfig.videoLimit
    : getModelMediaCapabilities(videoTargetVariant?.model).video.maxItems;
  const audioUploadLimit = workflowMediaConfig
    ? workflowMediaConfig.audioLimit
    : currentModelCapabilities.audio.maxItems;
  const showEndImageUpload = workflowMediaConfig
    ? workflowMediaConfig.separateEndImage
    : imageUploadCapability.separateLastItem;

  // What the empty drop well should say it takes. Naming only the kinds this
  // model actually accepts is the difference between an invitation and a lie:
  // the well used to offer "PNG, JPG or MP4" on models that take neither.
  const acceptedMediaTypes = [
    imageUploadLimit > 0 && "image",
    videoUploadLimit > 0 && "video",
    audioUploadLimit > 0 && "audio",
  ].filter(Boolean);
  const acceptedMediaHint = acceptedMediaTypes
    .map((type) => (type === "image" ? "Image" : type === "video" ? "Video" : "Audio"))
    .reduce(
      (sentence, word, index, all) =>
        index === 0
          ? word
          : index === all.length - 1
            ? `${sentence} or ${word}`
            : `${sentence}, ${word}`,
      "",
    );
  const hasUploadedMedia =
    uploadedImageUrls.length > 0 ||
    uploadedVideoUrls.length > 0 ||
    uploadedAudioUrls.length > 0 ||
    Boolean(uploadedEndImageUrl);
  // One invitation, not two. The well and the row of small upload buttons used
  // to appear together, which read as two different ways to do the same thing.
  const showMediaWell = !selectedWorkflowId && !hasUploadedMedia && acceptedMediaTypes.length > 0;

  // How many of duration, shape and resolution this model actually offers —
  // the grid needs the count up front, because a `false` child still counts.
  const sizePillCount = [showDuration, showAr, showResolution].filter(Boolean).length;

  const promptPlaceholder =
    selectedWorkflowId === "edit_video"
      ? "Describe how to edit the video"
      : selectedWorkflowId === "extend_uploaded_video"
        ? "Describe how to continue the video"
        : selectedWorkflowId === "motion_transfer"
          ? "Describe the motion"
          : v2vMode
            ? currentModelObj?.imageField
              ? currentModelObj?.promptRequired
                ? "Describe the motion"
                : "Describe the motion (optional)"
              : "Video ready — click Generate to remove watermark"
            : imageMode
              ? currentModelObj?.promptRequired
                ? "Describe the motion or effect"
                : "Describe the motion or effect (optional)"
              : isExtendMode
                ? "Optional: describe how to continue the video..."
                : "Describe the video you want to create";

  const toggleDropdown = (type) => (e) => {
    e.stopPropagation();
    setOpenDropdown((prev) => (prev === type ? null : type));
  };

  // ── the settings rail ─────────────────────────────────────────────────────
  //
  // Everything that decides what gets made, in the order the decisions happen:
  // what you give it, what to make, how good, then what that costs. It used to
  // be a floating bar of unlabelled pills over an empty canvas, with the price
  // revealed only after the money was spent.
  const settingsRail = (
    <SettingsRail
      tabs={
        railTabs.length > 1 ? (
          <RailTabs
            label="What to make"
            tabs={railTabs}
            value={activeTabId}
            onChange={(tabId) => handleRailTabSelect(tabId, railTabs)}
          />
        ) : null
      }
      footer={
        <CostMeter
          tier={selectedTier}
          balance={creditBalance}
          busy={generating}
          disabled={promptDisabled && !prompt.trim()}
          onGenerate={handleGenerate}
          onBuyCredits={openTopUp}
        />
      }
    >
      <QualityPoster
        toolId="videngine"
        tiers={qualityTiers}
        value={selectedTierId}
        onChange={handleTierSelect}
        kind="video"
        onPickModel={applyPickedModel}
      />

      {/* Where the footage comes from, on this tab. This replaces a dropdown
          labelled "Source": the options are two or three words each and the
          choice changes what every control below it means, so it should be
          readable without opening anything. */}
      {segmentOptions.length > 1 && (
        <div className="pt-0.5">
          <RailSegmented
            label="Source"
            options={segmentOptions}
            value={selectedWorkflowId || WORKFLOW_BASE_ID}
            onChange={handleSegmentSelect}
          />
        </div>
      )}
      {/* Only when this quality can actually take a photo or video. A labelled
        section with nothing inside it reads as something that failed to load. */}
      {canStartFromMedia && (
        <RailSection>
          {showMediaWell && (
            <RailWell
              label="Add references"
              hint={acceptedMediaHint}
              types={acceptedMediaTypes}
              onClick={() => {
                // Straight to the file picker for whatever this model takes
                // first. It used to open the workflow menu, which is now the
                // segmented control above — so the well was pointing at a
                // control the customer had already answered.
                if (imageUploadLimit > 0) imageFileInputRef.current?.click();
                else if (videoUploadLimit > 0) videoFileInputRef.current?.click();
                else audioFileInputRef.current?.click();
              }}
            />
          )}
          {/* Once the well is gone the slots take its place — in a card, so the
            upload buttons sit on a surface rather than floating on the panel. */}
          <div
            className={
              showMediaWell ? "hidden" : "flex flex-col gap-3 rounded-nova-card bg-nova-card p-5"
            }
          >
            {/* Inline list of uploaded media files. Kept mounted but hidden
              behind the well, because the file inputs it owns are what the
                well clicks. */}
            <div className="flex items-start gap-2.5 flex-wrap">
              {selectedWorkflowId ? (
                <>
                  {workflowMediaSlots.flatMap((slot) => {
                    const values = activeWorkflowMediaDraft?.[slot.id] || [];
                    return values.map((url, index) => (
                      <ReferencePreview
                        key={`${slot.id}:${index}:${url}`}
                        type={slot.mediaType}
                        url={url}
                        index={index}
                        onRemove={(itemIndex) => removeWorkflowMedia(slot.id, itemIndex)}
                        label={values.length > 1 ? `${slot.label} · ${index + 1}` : slot.label}
                        description={
                          values.length > 1 ? `${slot.description} ${index + 1}` : slot.description
                        }
                      />
                    ));
                  })}

                  {workflowMediaSlots.map((slot) => {
                    const values = activeWorkflowMediaDraft?.[slot.id] || [];
                    const remaining = getVideoWorkflowSlotRemaining(slot, activeWorkflowMediaDraft);
                    if (remaining <= 0) return null;
                    const uploadKey = `${workflowMediaDraftKey}:${slot.id}`;
                    const uploading = workflowUploadSlotId === uploadKey;
                    const progress =
                      slot.mediaType === "image"
                        ? imageProgress
                        : slot.mediaType === "video"
                          ? videoProgress
                          : audioProgress;
                    return (
                      <ReferenceUploadButton
                        key={slot.id}
                        accept={`${slot.mediaType}/*`}
                        multiple={remaining > 1}
                        onChange={async (event) => {
                          const files = Array.from(event.target.files || []);
                          event.target.value = "";
                          await uploadWorkflowSlotFiles(workflowMediaDraftKey, slot, files);
                        }}
                        title={`${slot.description || slot.label}${slot.required ? " (required)" : " (optional)"}`}
                        uploading={uploading}
                        progress={progress}
                        type={slot.mediaType}
                        label={slot.label}
                        required={slot.required}
                        disabled={Boolean(workflowUploadSlotId)}
                      />
                    );
                  })}
                </>
              ) : (
                <>
                  {uploadedImageUrls.map((url, index) => (
                    <ReferencePreview
                      key={url}
                      type="image"
                      url={url}
                      index={index}
                      onRemove={removeImageAtIndex}
                      label={uploadedImageUrls.length > 1 ? `Image · ${index + 1}` : "Image"}
                    />
                  ))}

                  {uploadedEndImageUrl && (
                    <ReferencePreview
                      type="image"
                      url={uploadedEndImageUrl}
                      index={0}
                      onRemove={clearEndImage}
                      label="End frame"
                    />
                  )}

                  {uploadedVideoUrls.map((url, index) => (
                    <ReferencePreview
                      key={url}
                      type="video"
                      url={url}
                      index={index}
                      onRemove={removeVideoAtIndex}
                      label={uploadedVideoUrls.length > 1 ? `Video · ${index + 1}` : "Video"}
                    />
                  ))}

                  {uploadedAudioUrls.map((url, index) => (
                    <ReferencePreview
                      key={url}
                      type="audio"
                      url={url}
                      index={index}
                      onRemove={removeAudioAtIndex}
                      label={uploadedAudioUrls.length > 1 ? `Audio · ${index + 1}` : "Audio"}
                    />
                  ))}

                  {/* Upload trigger buttons */}
                  {canUploadImageReference && uploadedImageUrls.length < imageUploadLimit && (
                    <ReferenceUploadButton
                      inputRef={imageFileInputRef}
                      accept="image/*"
                      multiple={imageUploadLimit - uploadedImageUrls.length > 1}
                      onChange={handleImageFileChange}
                      onClick={() => imageFileInputRef.current?.click()}
                      title={
                        selectedWorkflowId === "keyframes"
                          ? "Upload start frame"
                          : `Upload up to ${imageUploadLimit} reference images`
                      }
                      uploading={imageUploading}
                      progress={imageProgress}
                      type="image"
                    />
                  )}

                  {showEndImageUpload && !uploadedEndImageUrl && (
                    <ReferenceUploadButton
                      inputRef={endImageFileInputRef}
                      accept="image/*"
                      multiple={false}
                      onChange={handleEndImageFileChange}
                      onClick={() => endImageFileInputRef.current?.click()}
                      title="Upload end frame"
                      uploading={endImageUploading}
                      progress={endImageProgress}
                      type="image"
                    />
                  )}

                  {videoUploadLimit > 0 && uploadedVideoUrls.length < videoUploadLimit && (
                    <ReferenceUploadButton
                      inputRef={videoFileInputRef}
                      accept="video/*"
                      multiple={videoUploadLimit - uploadedVideoUrls.length > 1}
                      onChange={handleVideoFileChange}
                      onClick={() => videoFileInputRef.current?.click()}
                      title={`Upload up to ${videoUploadLimit} reference videos`}
                      uploading={videoUploading}
                      progress={videoProgress}
                      type="video"
                    />
                  )}

                  {audioUploadLimit > 0 && uploadedAudioUrls.length < audioUploadLimit && (
                    <ReferenceUploadButton
                      inputRef={audioFileInputRef}
                      accept="audio/*"
                      multiple={audioUploadLimit - uploadedAudioUrls.length > 1}
                      onChange={handleAudioFileChange}
                      onClick={() => audioFileInputRef.current?.click()}
                      title={`Upload up to ${audioUploadLimit} reference audio files`}
                      uploading={audioUploading}
                      progress={audioProgress}
                      type="audio"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </RailSection>
      )}

      {/* The prompt, as a card rather than a labelled input.

          The name sits in the card's header and the controls that belong to the
          prompt — references, drawing — sit in its footer, each behind a
          hairline. So the whole of "what to say" is one object with three
          registers, instead of a heading, a box, and a distant row of pills. */}
      <RailCard
        className="cursor-text"
        onClick={() => textareaRef.current?.focus()}
        header={
          <label htmlFor={promptFieldId} className="block cursor-text">
            <RailCardTitle>Prompt</RailCardTitle>
          </label>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <RailChip
              icon={<AtIcon />}
              disabled={imageUploadLimit < 1 || uploadedImageUrls.length >= imageUploadLimit}
              onClick={(event) => {
                event.stopPropagation();
                imageFileInputRef.current?.click();
              }}
            >
              Elements
            </RailChip>
            {canUploadImageReference && (
              <RailChip
                icon={<PencilIcon size={14} />}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsDrawModalOpen(true);
                }}
              >
                Draw
              </RailChip>
            )}
          </div>
        }
      >
        <PromptTextarea
          id={promptFieldId}
          ref={textareaRef}
          value={prompt}
          onChange={handlePromptInput}
          placeholder={promptPlaceholder}
          disabled={promptDisabled}
        />
      </RailCard>

      {/* Continuing an earlier generation. A statement of fact about the job,
        not a control, so it is the quietest thing in the rail. */}
      {isExtendMode && (
        <div className="flex items-center gap-2.5 rounded-nova-btn bg-nova-card px-5 py-3.5 text-[14px] font-medium text-nova-muted">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="flex-shrink-0"
            aria-hidden
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span>Continuing the previous VidEngine generation</span>
        </div>
      )}

      {/* The controls the chosen quality actually supports.
          Model first, on a row of its own: it is the decision every control
            under it depends on, so it is not a pill among pills. Then duration,
              shape and resolution side by side, because they are three answers to
                one question — how big is this — and given a row each they read as
                  three separate decisions. */}
      <div ref={dropdownRef} className="space-y-2">
        <RailRow
          label="Model"
          value={selectedPickerEntry?.name || selectedFamily?.name || "Choose a model"}
          adornment={
            <span className="flex-shrink-0 text-nova-accent">
              <EqualiserIcon size={15} />
            </span>
          }
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("meerah:pick-model", { detail: { kind: "video" } }),
            )
          }
        />

        {sizePillCount > 0 && (
          <RailPillRow columns={sizePillCount}>
            {showDuration && (
              <div className="relative">
                <RailPill
                  icon={<ClockIcon size={16} />}
                  active={openDropdown === "duration"}
                  onClick={toggleDropdown("duration")}
                >
                  {selectedDuration}s
                </RailPill>
                {openDropdown === "duration" && (
                  <PromptPopover
                    positionClassName={POPOVER_ABOVE_LEFT}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PromptPopoverHeader>Duration</PromptPopoverHeader>
                    <PromptMenuList>
                      {getCurrentDurations(selectedModel).map((d) => (
                        <PromptMenuItem
                          key={d}
                          selected={selectedDuration === d}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDuration(d);
                            setOpenDropdown(null);
                          }}
                        >
                          {d}s
                        </PromptMenuItem>
                      ))}
                    </PromptMenuList>
                  </PromptPopover>
                )}
              </div>
            )}

            {showAr && (
              <div className="relative">
                <RailPill
                  icon={<FrameIcon size={16} />}
                  active={openDropdown === "ar"}
                  onClick={toggleDropdown("ar")}
                >
                  {selectedAr}
                </RailPill>
                {openDropdown === "ar" && (
                  <PromptPopover
                    positionClassName={POPOVER_ABOVE_LEFT}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PromptPopoverHeader>Aspect Ratio</PromptPopoverHeader>
                    <PromptMenuList>
                      {getCurrentAspectRatios(selectedModel).map((r) => (
                        <PromptMenuItem
                          key={r}
                          selected={selectedAr === r}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAr(r);
                            setOpenDropdown(null);
                          }}
                        >
                          {r}
                        </PromptMenuItem>
                      ))}
                    </PromptMenuList>
                  </PromptPopover>
                )}
              </div>
            )}

            {showResolution && (
              <div className="relative">
                <RailPill
                  icon={<GemIcon size={16} />}
                  active={openDropdown === "resolution"}
                  onClick={toggleDropdown("resolution")}
                >
                  {selectedResolution || "720p"}
                </RailPill>
                {openDropdown === "resolution" && (
                  <PromptPopover
                    positionClassName={POPOVER_ABOVE_RIGHT}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PromptPopoverHeader>Resolution</PromptPopoverHeader>
                    <PromptMenuList>
                      {getCurrentResolutions(selectedModel).map((r) => (
                        <PromptMenuItem
                          key={r}
                          selected={selectedResolution === r}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedResolution(r);
                            setOpenDropdown(null);
                          }}
                        >
                          {r}
                        </PromptMenuItem>
                      ))}
                    </PromptMenuList>
                  </PromptPopover>
                )}
              </div>
            )}
          </RailPillRow>
        )}

        {showEffect && (
          <div className="relative">
            <RailInlineRow
              icon={
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="flex-shrink-0"
                  aria-hidden
                >
                  <path d="M6 4l13 8-13 8V4z" strokeLinejoin="round" />
                </svg>
              }
              label="Effect"
              value={selectedEffect || "None"}
              onClick={toggleDropdown("effect")}
            />
            {openDropdown === "effect" && (
              <PromptPopover
                positionClassName={POPOVER_ABOVE_LEFT}
                className="min-w-[200px]"
                onClick={(e) => e.stopPropagation()}
              >
                <PromptPopoverHeader>Effect Type</PromptPopoverHeader>
                <PromptMenuList>
                  {getEffectsForI2VModel(selectedModel).map((eff) => (
                    <PromptMenuItem
                      key={eff}
                      selected={selectedEffect === eff}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEffect(eff);
                        setOpenDropdown(null);
                      }}
                    >
                      {eff}
                    </PromptMenuItem>
                  ))}
                </PromptMenuList>
              </PromptPopover>
            )}
          </div>
        )}

        {/* Model-specific knobs, closed. Long, model-specific and irrelevant to
          most jobs — but hiding them entirely is what made the old UI feel
            like it was keeping secrets. */}
        <ModelParameterControls
          inputs={supplementalInputs}
          values={modelParameterValues}
          onChange={(key, value) =>
            setModelParameterValues((values) => ({ ...values, [key]: value }))
          }
          open={openDropdown === "parameters"}
          onToggle={toggleDropdown("parameters")}
        />
      </div>
    </SettingsRail>
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col lg:flex-row bg-nova-bg relative overflow-hidden"
    >
      {/* ── LEFT: SETTINGS RAIL ── */}
      {settingsRail}

      {/* ── RIGHT: THE WORK ── */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <div className="flex-1 min-h-0 w-full">
          <WorkTabs
            toolId="videngine"
            hasResults={history.length > 0}
            results={
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-4 animate-fade-in-up">
                  {history.map((entry, idx) => {
                    const isSeedance2 =
                      entry.model === "seedance-v2.0-t2v" || entry.model === "seedance-v2.0-i2v";
                    return (
                      <div
                        key={entry.id || idx}
                        className="relative group rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--night)] shadow-xl hover:border-[var(--line-hi)] transition-all duration-300 flex flex-col cursor-pointer"
                        onClick={() => setFullscreenUrl(entry.url)}
                      >
                        <video
                          src={entry.url}
                          className="w-full aspect-video object-cover bg-[var(--night)] hover:opacity-80 transition-opacity"
                          controls={false}
                          loop
                          muted
                          playsInline
                          onMouseOver={(e) => e.target.play()}
                          onMouseOut={(e) => {
                            e.target.pause();
                            e.target.currentTime = 0;
                          }}
                        />

                        {/* Overlay actions */}
                        <div className="absolute top-2 right-2 hidden md:flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GenerationCopyButtons
                            prompt={entry.prompt}
                            onCopyError={onGenerationError}
                          />
                          <button
                            type="button"
                            title="Download"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(entry.url, `video-${entry.id || idx}.mp4`);
                            }}
                            className="p-2 bg-[var(--surface)] backdrop-blur-md rounded-full text-[var(--chalk)] hover:bg-[var(--slab-hi)] hover:text-[var(--chalk)] transition-all border border-[var(--line)]"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                          </button>
                          {isSeedance2 && (
                            <button
                              type="button"
                              title="Extend this video using Seedance 2.0 Extend"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExtend(entry.id, entry.model);
                              }}
                              className="p-2 bg-[var(--surface)] backdrop-blur-md rounded-full text-[var(--chalk)] hover:bg-[var(--slab-hi)] hover:text-[var(--chalk)] transition-all border border-[var(--line)]"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure you want to delete this generated item?")) {
                                handleDeleteEntry(entry, idx).catch((err) => {
                                  onGenerationError?.(err.message || "Failed to delete item");
                                });
                              }
                            }}
                            className="p-2 bg-[var(--surface)] backdrop-blur-md rounded-full text-red-400 hover:bg-red-500 hover:text-[var(--chalk)] transition-all border border-[var(--line)]"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                        <MobileGenerationActions
                          prompt={entry.prompt}
                          onCopyError={onGenerationError}
                          actions={[
                            {
                              kind: "download",
                              label: "Download",
                              onSelect: () =>
                                downloadFile(entry.url, `video-${entry.id || idx}.mp4`),
                            },
                            isSeedance2 && {
                              kind: "extend",
                              label: "Extend",
                              onSelect: () => handleExtend(entry.id, entry.model),
                            },
                            {
                              kind: "delete",
                              label: "Delete",
                              danger: true,
                              onSelect: () => {
                                if (
                                  confirm("Are you sure you want to delete this generated item?")
                                ) {
                                  handleDeleteEntry(entry, idx).catch((err) => {
                                    onGenerationError?.(err.message || "Failed to delete item");
                                  });
                                }
                              },
                            },
                          ]}
                        />

                        {/* Prompt & Details */}
                        <div className="p-3 bg-[var(--surface)] backdrop-blur-sm border-t border-[var(--line)] flex-1 flex flex-col justify-between gap-2">
                          <p
                            className="text-[var(--iron)] text-xs line-clamp-3 leading-relaxed"
                            title={entry.prompt}
                          >
                            {entry.prompt || "No prompt provided"}
                          </p>
                          <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-[var(--lilac)] px-2 py-0.5 bg-[var(--slab-hi)] rounded border border-[var(--line)] whitespace-nowrap capitalize">
                                {entry.model?.replace("-", "") || "Video Studio"}
                              </span>
                              <div className="flex gap-2">
                                {entry.resolution && (
                                  <span className="text-[10px] text-[var(--fog)]">
                                    {entry.resolution}
                                  </span>
                                )}
                                {entry.duration && (
                                  <span className="text-[10px] text-[var(--fog)]">
                                    {entry.duration}s
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            }
            history={
              history.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-4 animate-fade-in-up">
                    {history.map((entry, idx) => {
                      const isSeedance2 =
                        entry.model === "seedance-v2.0-t2v" || entry.model === "seedance-v2.0-i2v";
                      return (
                        <div
                          key={entry.id || idx}
                          className="relative group rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--night)] shadow-xl hover:border-[var(--line-hi)] transition-all duration-300 flex flex-col cursor-pointer"
                          onClick={() => setFullscreenUrl(entry.url)}
                        >
                          <video
                            src={entry.url}
                            className="w-full aspect-video object-cover bg-[var(--night)] hover:opacity-80 transition-opacity"
                            controls={false}
                            loop
                            muted
                            playsInline
                            onMouseOver={(e) => e.target.play()}
                            onMouseOut={(e) => {
                              e.target.pause();
                              e.target.currentTime = 0;
                            }}
                          />

                          {/* Overlay actions */}
                          <div className="absolute top-2 right-2 hidden md:flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GenerationCopyButtons
                              prompt={entry.prompt}
                              onCopyError={onGenerationError}
                            />
                            <button
                              type="button"
                              title="Download"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadFile(entry.url, `video-${entry.id || idx}.mp4`);
                              }}
                              className="p-2 bg-[var(--surface)] backdrop-blur-md rounded-full text-[var(--chalk)] hover:bg-[var(--slab-hi)] hover:text-[var(--chalk)] transition-all border border-[var(--line)]"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                              </svg>
                            </button>
                            {isSeedance2 && (
                              <button
                                type="button"
                                title="Extend this video using Seedance 2.0 Extend"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExtend(entry.id, entry.model);
                                }}
                                className="p-2 bg-[var(--surface)] backdrop-blur-md rounded-full text-[var(--chalk)] hover:bg-[var(--slab-hi)] hover:text-[var(--chalk)] transition-all border border-[var(--line)]"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm("Are you sure you want to delete this generated item?")
                                ) {
                                  handleDeleteEntry(entry, idx).catch((err) => {
                                    onGenerationError?.(err.message || "Failed to delete item");
                                  });
                                }
                              }}
                              className="p-2 bg-[var(--surface)] backdrop-blur-md rounded-full text-red-400 hover:bg-red-500 hover:text-[var(--chalk)] transition-all border border-[var(--line)]"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                          <MobileGenerationActions
                            prompt={entry.prompt}
                            onCopyError={onGenerationError}
                            actions={[
                              {
                                kind: "download",
                                label: "Download",
                                onSelect: () =>
                                  downloadFile(entry.url, `video-${entry.id || idx}.mp4`),
                              },
                              isSeedance2 && {
                                kind: "extend",
                                label: "Extend",
                                onSelect: () => handleExtend(entry.id, entry.model),
                              },
                              {
                                kind: "delete",
                                label: "Delete",
                                danger: true,
                                onSelect: () => {
                                  if (
                                    confirm("Are you sure you want to delete this generated item?")
                                  ) {
                                    handleDeleteEntry(entry, idx).catch((err) => {
                                      onGenerationError?.(err.message || "Failed to delete item");
                                    });
                                  }
                                },
                              },
                            ]}
                          />

                          {/* Prompt & Details */}
                          <div className="p-3 bg-[var(--surface)] backdrop-blur-sm border-t border-[var(--line)] flex-1 flex flex-col justify-between gap-2">
                            <p
                              className="text-[var(--iron)] text-xs line-clamp-3 leading-relaxed"
                              title={entry.prompt}
                            >
                              {entry.prompt || "No prompt provided"}
                            </p>
                            <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[var(--lilac)] px-2 py-0.5 bg-[var(--slab-hi)] rounded border border-[var(--line)] whitespace-nowrap capitalize">
                                  {entry.model?.replace("-", "") || "Video Studio"}
                                </span>
                                <div className="flex gap-2">
                                  {entry.resolution && (
                                    <span className="text-[10px] text-[var(--fog)]">
                                      {entry.resolution}
                                    </span>
                                  )}
                                  {entry.duration && (
                                    <span className="text-[10px] text-[var(--fog)]">
                                      {entry.duration}s
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null
            }
          />
        </div>
      </div>

      {/* ── FULLSCREEN VIDEO MODAL ── */}
      {fullscreenUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--scrim)] backdrop-blur-sm animate-fade-in"
          onClick={() => setFullscreenUrl(null)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 p-3 bg-[var(--night)] hover:bg-[var(--slab)] rounded-full text-[var(--chalk)] transition-colors border border-[var(--line)]"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenUrl(null);
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <video
            src={fullscreenUrl}
            controls
            autoPlay
            loop
            className="max-w-[95vw] max-h-[95vh] rounded-2xl shadow-2xl object-contain animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <DrawModal
        isOpen={isDrawModalOpen}
        onClose={() => setIsDrawModalOpen(false)}
        apiKey={apiKey}
        batchSize={1}
        onAddHistoryItem={handleDrawReference}
      />
      <Toaster
        position="top-right"
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          duration: 5000,
          style: {
            background: "var(--slab-hi)",
            color: "var(--surface)",
            border: "1px solid rgba(255,255,255,0.15)",
            fontSize: "13px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            maxWidth: "440px",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            padding: "12px 16px",
          },
        }}
      />
    </div>
  );
}
