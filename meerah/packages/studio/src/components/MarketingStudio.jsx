"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SettingsRail, RailSection } from "./rail/SettingsRail";
import ToolShowcase from "./rail/ToolShowcase";
import { QualityPicker, useQualityTiers } from "./rail/QualityPicker";
import { CostMeter } from "./rail/CostMeter";
import { uploadFile, generateMarketingStudioAd, getUserBalance } from "../muapi.js";
import { scopedPersistKey, migrateLegacyPersistKey } from "../persistKey.js";
import MobileGenerationActions, {
  GenerationCopyButtons,
} from "./MobileGenerationActions.jsx";
import {
  PROMPT_CONTROL_LABEL_CLASS,
  PromptAspectRatioIcon,
  PromptAction,
  PromptChevronIcon,
  PromptComposer,
  PromptControls,
  PromptFooter,
  PromptMenuItem,
  PromptMenuList,
  PromptPopover,
  PromptPopoverHeader,
  PromptDurationIcon,
  PromptQualityIcon,
  PromptTextarea,
  promptControlClassName,
  promptMediaButtonClassName,
} from "./prompt/PromptComposer.jsx";

const SCROLLBAR_STYLE = `
  .custom-scrollbar-thin::-webkit-scrollbar {
    height: 4px;
  }
  .custom-scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(34, 211, 238, 0.3);
  }
`;

// ── Icons ────────────────────────────────────────────────────────────────────

const CheckSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="4">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlusSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CloseSvg = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ProductIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 8l-2-2H5L3 8v10a2 2 0 002 2h14a2 2 0 002-2V8z" />
    <path d="M3 10h18" />
    <path d="M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
  </svg>
);

const AvatarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const RefIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

// ── Assets ───────────────────────────────────────────────────────────────────

const ASSETS = {
  avatar: [
    { id: "aa252283-8591-4d14-91a8-41ce54187992", name: "Priya", url: "/vendor-asset/web-app/Priya.webp" },
    { id: "ba6c9b18-f79c-4dab-9649-88a181d0a038", name: "Elena", url: "/vendor-asset/web-app/Elena.webp" },
    { id: "30e2cadd-987c-4a7a-81c3-094d4fb3a65e", name: "Kai", url: "/vendor-asset/web-app/Kai.webp" },
    { id: "fbed59e1-4b8d-4625-9140-ef2044e0be72", name: "Sora", url: "/vendor-asset/web-app/Sora.webp" },
    { id: "bcd9e6ee-c000-48e6-9f4b-a20fc2a674f7", name: "Minji", url: "/vendor-asset/web-app/Minji.webp" },
    { id: "1da384ed-3856-45e4-bf4c-a496c7aa95ff", name: "Margot", url: "/vendor-asset/web-app/Margot.webp" },
    { id: "b799c8f5-fb6e-4905-b33b-cdefac153ec3", name: "Niko", url: "/vendor-asset/web-app/Niko.webp" },
    { id: "b6971dd4-55fa-4e64-b318-392b16504284", name: "Jin", url: "/vendor-asset/web-app/Jin.webp" }
  ],
  ugc: [
    { id: 1, name: "UGC", url: "/vendor-asset/web-app/ugc.mp4" },
    { id: 2, name: "Tutorial", url: "/vendor-asset/web-app/ugc_how_to.mp4" },
    { id: 3, name: "Unboxing", url: "/vendor-asset/web-app/ugc_unboxing.mp4" },
    { id: 4, name: "Hyper Motion", url: "/vendor-asset/web-app/hyper-motion-mini.mp4" },
    { id: 5, name: "Product Review", url: "/vendor-asset/web-app/product_review.mp4" },
    { id: 6, name: "TV Spot", url: "/vendor-asset/web-app/tv-spot-mini.mp4" }
  ]
};

const OPTIONS = {
  ratio: ["9:16", "3:4", "4:3", "16:9", "1:1"],
  res: ["720p", "1080p"],
  duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
};

// ── Components ───────────────────────────────────────────────────────────────

function UploadSlot({ icon, url, progress, label, onUpload, onClear, multiple = false, images = [] }) {
  const inputRef = useRef(null);
  
  return (
    <div className="relative group/slot flex items-center">
      <div 
        onClick={() => inputRef.current?.click()}
        title={`Upload ${label}`}
        className={promptMediaButtonClassName({
          active: Boolean(url),
          className: "cursor-pointer",
        })}
      >
        <input 
          ref={inputRef} 
          type="file" 
          accept="image/*"
          className="hidden" 
          multiple={multiple}
          onChange={(e) => onUpload(e)} 
        />
        
        {progress > 0 && progress < 100 ? (
          <div className="absolute inset-0 bg-[var(--surface)] rounded-full flex items-center justify-center z-10">
            <span className="text-[8px] font-black text-primary">{progress}%</span>
          </div>
        ) : url ? (
          <div className="w-full h-full rounded-full overflow-hidden border border-black/20">
            <img src={url} className="w-full h-full object-cover" alt={label} />
          </div>
        ) : (
          <div className="text-[var(--fog)] group-hover:text-primary transition-colors">
            {icon}
          </div>
        )}

        {/* Clear Button (Single) */}
        {url && !multiple && (
          <button 
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[var(--chalk)] rounded-full flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity shadow-lg"
          >
            <CloseSvg />
          </button>
        )}
      </div>      
    </div>
  );
}

function Dropdown({ isOpen, title, items, selectedId, onSelect, onClose, isVideo = false, onPreview = null }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <PromptPopover
      ref={ref}
      className="w-[420px] max-w-[calc(100vw-2rem)]"
    >
      <PromptPopoverHeader className="mb-3">{title}</PromptPopoverHeader>
      <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
        {items.map(item => (
          <div 
            key={item.id}
            onClick={() => onSelect(item)}
            className={`relative rounded overflow-hidden border-2 transition-all group cursor-pointer ${
              selectedId === item.id || selectedId === item.url ? 'border-primary shadow-glow' : 'border-[var(--line)] hover:border-[var(--line)]'
            }`}
          >
            {onPreview && !isVideo && (
              <button
                type="button"
                title="Enlarge preview"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(item);
                }}
                className="absolute top-1.5 left-1.5 w-6 h-6 bg-[var(--surface)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--action)] hover:text-[var(--chalk)] transition-all border border-[var(--line)] z-20 text-[var(--iron)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
            )}

            {isVideo ? (
              <video src={item.url} autoPlay loop muted className="w-full aspect-[3/4] object-cover group-hover:scale-105 transition-all duration-500" />
            ) : (
              <img src={item.url} className="w-full aspect-square object-cover group-hover:scale-105 transition-all duration-500" alt={item.name} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[9px] font-black text-[var(--chalk)] uppercase tracking-tight">{item.name}</span>
            </div>
            {(selectedId === item.id || selectedId === item.url) && (
              <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <CheckSvg />
              </div>
            )}
          </div>
        ))}
      </div>
    </PromptPopover>
  );
}

function SimpleDropdown({ isOpen, title, options, selected, onSelect, onClose }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <PromptPopover
      ref={ref}
    >
      <PromptPopoverHeader>{title}</PromptPopoverHeader>
      <PromptMenuList>
      {options.map(opt => (
        <PromptMenuItem
          key={opt}
          selected={selected === opt}
          onClick={() => { onSelect(opt); onClose(); }}
        >
          {opt}
        </PromptMenuItem>
      ))}
      </PromptMenuList>
    </PromptPopover>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MarketingStudio({
  apiKey,
  droppedFiles,
  onFilesHandled,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  historyItems,
}) {
  const LEGACY_PERSIST_KEY = "hg_marketing_studio_persistent";
  const PERSIST_KEY = scopedPersistKey(LEGACY_PERSIST_KEY, apiKey);
  useEffect(() => {
    migrateLegacyPersistKey(LEGACY_PERSIST_KEY, PERSIST_KEY);
  }, [PERSIST_KEY]);
  
  const [prompt, setPrompt] = useState("");
  const [productImage, setProductImage] = useState(null);
  const [avatarImage, setAvatarImage] = useState(null);
  const [additionalImages, setAdditionalImages] = useState([]);
  
  const [params, setParams] = useState({
    ratio: "9:16",
    format: ASSETS.ugc[0].name,
    videoUrl: ASSETS.ugc[0].url,
    res: "1080p",
    duration: 5
  });

  const [localHistory, setLocalHistory] = useState([]);
  const history = historyItems ?? localHistory;
  // Which quality is chosen, and what the account has to spend — both feed the
  // cost meter at the foot of the rail.
  const [selectedTierId, setSelectedTierId] = useState("draft");
  const [creditBalance, setCreditBalance] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dropdown, setDropdown] = useState(null); // 'format' | 'avatar' | 'ratio' | 'res' | 'duration'
  const [uploadProgress, setUploadProgress] = useState({ product: 0, avatar: 0, additional: 0 });
  const [fullscreenUrl, setFullscreenUrl] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [slideDirection, setSlideDirection] = useState("next"); // 'next' | 'prev'

  const textareaRef = useRef(null);

  // ── Persistence ───────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.prompt) setPrompt(data.prompt);
        if (data.params) setParams(data.params);
        if (data.productImage) setProductImage(data.productImage);
        if (data.avatarImage) setAvatarImage(data.avatarImage);
        if (data.additionalImages) setAdditionalImages(data.additionalImages);
        if (data.localHistory) setLocalHistory(data.localHistory);
        else if (data.history) setLocalHistory(data.history);
      }
    } catch (err) { console.warn("Load failed", err); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const state = { prompt, params, productImage, avatarImage, additionalImages, localHistory };
      localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
    }, 500);
    return () => clearTimeout(timer);
  }, [prompt, params, productImage, avatarImage, additionalImages, localHistory]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const downloadFile = async (url, filename) => {
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
  };

  const handleUpload = async (e, target) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    if (target === 'additional') {
      const remaining = 6 - additionalImages.length;
      const toUpload = files.slice(0, remaining);
      for (const file of toUpload) {
        try {
          const url = await uploadFile(apiKey, file, (pct) => setUploadProgress(p => ({ ...p, additional: pct })));
          setAdditionalImages(prev => [...prev, url].slice(0, 6));
        } catch (err) { alert(err.message); }
      }
    } else {
      const file = files[0];
      try {
        const url = await uploadFile(apiKey, file, (pct) => setUploadProgress(p => ({ ...p, [target]: pct })));
        if (target === 'product') setProductImage(url);
        else setAvatarImage(url);
      } catch (err) { alert(err.message); }
    }
    setUploadProgress(p => ({ ...p, [target]: 0 }));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return alert("Please enter an ad script.");
    if (!productImage) return alert("Please upload a product image.");

    onGenerationStart?.();
    setIsGenerating(true);
    try {
      const result = await generateMarketingStudioAd(apiKey, {
        prompt,
        aspect_ratio: params.ratio,
        duration: params.duration,
        resolution: params.res,
        images_list: [productImage, avatarImage, ...additionalImages].filter(Boolean),
        video_files: params.videoUrl ? [params.videoUrl] : []
      });

      if (result?.url) {
        const entry = {
          id: Date.now(),
          url: result.url,
          prompt,
          format: params.format,
          timestamp: new Date().toISOString()
        };
        if (!historyItems) {
          setLocalHistory(prev => [entry, ...prev]);
        }
        setFullscreenUrl(result.url);
        onGenerationComplete?.({ url: result.url, type: "video" });
      }
    } catch (err) {
      onGenerationError?.(err.message?.slice(0, 120) || "Marketing generation failed");
    } finally {
      setIsGenerating(false);
      onGenerationEnd?.();
    }
  };

  const qualityTiers = useQualityTiers("video");
  const selectedTier = qualityTiers.find((t) => t.tierId === selectedTierId) || null;

  // A tier names an exact model, and the server only honours the tier price
  // when that exact id is submitted.
  const handleTierSelect = useCallback((tier) => {
    setSelectedTierId(tier.tierId);
    // No model to pin: this tool runs one pipeline, and the tier only
    // decides the quality it renders at.
  }, []);

  const refreshBalance = useCallback(() => {
    getUserBalance(apiKey).then((r) => setCreditBalance(r.balance)).catch(() => {});
  }, [apiKey]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // Buying credits belongs to the shell, which can show the sheet over any page.
  const openTopUp = useCallback(() => {
    window.dispatchEvent(new CustomEvent("meerah:buy-credits"));
  }, []);

  // ── the settings rail ─────────────────────────────────────────────────────
  //
  // The same column every tool uses: what you give it, what to make, how good,
  // then what it costs. Replaces a floating bar of unlabelled pills whose price
  // only appeared after the money was spent.
  const settingsRail = (
    <SettingsRail
      footer={
        <CostMeter
          tier={selectedTier}
          balance={creditBalance}
          busy={isGenerating}
          onGenerate={handleGenerate}
          onBuyCredits={openTopUp}
        />
      }
    >
      <RailSection label="Your product">
          {additionalImages.length > 0 && (
            <div className="flex items-center gap-1.5">
              {additionalImages.map((img, idx) => (
                <div key={idx} className="relative group/img flex-shrink-0">
                  <img src={img} className="w-9 h-9 rounded-full object-cover border border-[var(--line)]" />
                  <button 
                    onClick={() => setAdditionalImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[var(--surface)] text-[var(--chalk)] rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity border border-[var(--line)]"
                  >
                    <CloseSvg />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Top Row: Full-width Textarea */}
          <div className="w-full relative">
            <PromptTextarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your ad script... Use @image1 for product, @image2 for avatar."
            />
          </div>

          {/* Bottom Row: Uploads + Controls + Generate */}
      </RailSection>

      <RailSection label="Quality" hint="Every price is the full cost of one video. Nothing else is added.">
        <QualityPicker tiers={qualityTiers} value={selectedTierId} onChange={handleTierSelect} />
      </RailSection>

      <RailSection label="Settings">
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Asset Uploads Group */}
              <div className="flex items-center gap-1.5 pr-3 border-r border-[var(--line)]">
                <UploadSlot 
                  label="Product" 
                  icon={<ProductIcon />} 
                  url={productImage} 
                  progress={uploadProgress.product} 
                  onUpload={(e) => handleUpload(e, 'product')} 
                  onClear={() => setProductImage(null)} 
                />
                <UploadSlot 
                  label="Avatar" 
                  icon={<AvatarIcon />} 
                  url={avatarImage} 
                  progress={uploadProgress.avatar} 
                  onUpload={(e) => handleUpload(e, 'avatar')} 
                  onClear={() => setAvatarImage(null)} 
                />
                <UploadSlot 
                  label="References" 
                  icon={<RefIcon />} 
                  url={additionalImages[0]} 
                  progress={uploadProgress.additional} 
                  multiple 
                  images={additionalImages}
                  onUpload={(e) => handleUpload(e, 'additional')} 
                  onClear={(idx) => {
                    if (idx !== undefined) {
                      setAdditionalImages(prev => prev.filter((_, i) => i !== idx));
                    } else {
                      setAdditionalImages([]);
                    }
                  }} 
                />
              </div>

              {/* Format Button */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setDropdown(dropdown === 'format' ? null : 'format'); }}
                  className={promptControlClassName({
                    active: dropdown === "format",
                  })}
                >
                  <div className="w-4 h-4 bg-primary/10 rounded flex items-center justify-center border border-primary/20">
                    <span className="text-[8px] font-black text-primary uppercase">U</span>
                  </div>
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>{params.format}</span>
                  <PromptChevronIcon />
                </button>
                <Dropdown 
                  isOpen={dropdown === 'format'} 
                  title="Video Format Presets"
                  items={ASSETS.ugc} 
                  selectedId={params.format}
                  onSelect={(item) => setParams({ ...params, format: item.name, videoUrl: item.url })}
                  onClose={() => setDropdown(null)}
                  isVideo
                />
              </div>

              {/* Avatar Preset Button */}
              <div className="relative flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setDropdown(dropdown === 'avatar' ? null : 'avatar'); }}
                  className={promptControlClassName({
                    active: dropdown === "avatar",
                  })}
                >
                  <div className="w-4 h-4 rounded-full overflow-hidden border border-[var(--line)] shadow-inner">
                    <img src={avatarImage || ASSETS.avatar[0].url} className="w-full h-full object-cover" />
                  </div>
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {ASSETS.avatar.find(a => a.url === avatarImage)?.name || "Select Avatar"}
                  </span>
                  <PromptChevronIcon />
                </button>

                {avatarImage && (
                  <button
                    type="button"
                    title="Enlarge selected avatar"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentAvatar = ASSETS.avatar.find(a => a.url === avatarImage);
                      if (currentAvatar) {
                        setPreviewAvatar(currentAvatar);
                      } else {
                        setPreviewAvatar({ id: "custom", name: "Custom Uploaded Avatar", url: avatarImage });
                      }
                    }}
                    className={promptControlClassName({
                      iconOnly: true,
                      className: "text-[var(--fog)] hover:text-[var(--chalk)]",
                    })}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      <line x1="11" y1="8" x2="11" y2="14" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                  </button>
                )}

                <Dropdown 
                  isOpen={dropdown === 'avatar'} 
                  title="Avatar Presets"
                  items={ASSETS.avatar} 
                  selectedId={avatarImage}
                  onSelect={(item) => setAvatarImage(item.url)}
                  onPreview={(item) => setPreviewAvatar(item)}
                  onClose={() => setDropdown(null)}
                />
              </div>

              {/* Simple Controls */}
              {['ratio', 'res', 'duration'].map(key => (
                <div key={key} className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDropdown(dropdown === key ? null : key); }}
                    className={promptControlClassName({
                      active: dropdown === key,
                      className:
                        dropdown === key
                          ? "text-xs font-semibold text-[var(--chalk)]"
                          : "text-xs font-semibold text-[var(--iron)]",
                    })}
                  >
                    {key === "ratio" ? (
                      <PromptAspectRatioIcon />
                    ) : key === "res" ? (
                      <PromptQualityIcon />
                    ) : (
                      <PromptDurationIcon />
                    )}
                    <span className={PROMPT_CONTROL_LABEL_CLASS}>
                      {key === "duration" ? `${params[key]}s` : params[key]}
                    </span>
                  </button>
                  <SimpleDropdown 
                    isOpen={dropdown === key} 
                    title={
                      key === "ratio"
                        ? "Aspect Ratio"
                        : key === "res"
                          ? "Resolution"
                          : "Duration"
                    }
                    options={OPTIONS[key]} 
                    selected={params[key]} 
                    onSelect={(val) => setParams({ ...params, [key]: val })} 
                    onClose={() => setDropdown(null)} 
                  />
                </div>
              ))}
            </div>
      </RailSection>
    </SettingsRail>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-app-bg relative overflow-hidden">
      {/* ── LEFT: SETTINGS RAIL ── */}
      {settingsRail}

      {/* ── RIGHT: THE WORK ── */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
      <style>{SCROLLBAR_STYLE}</style>
      
      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto custom-scrollbar pb-8 px-2">
        {history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-4 animate-fade-in-up">
            {history.map(entry => (
              <div
                key={entry.id}
                onClick={() => setFullscreenUrl(entry.url)}
                className="relative group rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--night)] shadow-xl hover:border-primary/50 transition-all duration-300 flex flex-col cursor-pointer"
              >
                <video 
                  src={entry.url} 
                  className="w-full aspect-video object-cover hover:opacity-80 transition-opacity" 
                  muted loop onMouseOver={e => e.target.play()} onMouseOut={e => { e.target.pause(); e.target.currentTime = 0; }}
                />
                
                {/* Actions Overlay */}
                <div className="absolute top-2 right-2 hidden md:flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GenerationCopyButtons
                    prompt={entry.prompt}
                    onCopyError={onGenerationError}
                  />
                   <button
                    onClick={(e) => { e.stopPropagation(); downloadFile(entry.url, `marketing-ad-${entry.id}.mp4`); }}
                    className="p-2 bg-[var(--surface)] backdrop-blur-md rounded-full text-[var(--chalk)] hover:bg-primary hover:text-[var(--chalk)] transition-all border border-[var(--line)]"
                    title="Download"
                   >
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                       <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                     </svg>
                   </button>
                   <button
                    type="button"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Are you sure you want to delete this generated item?")) {
                        if (!historyItems) {
                          setLocalHistory(prev => prev.filter(h => h.id !== entry.id));
                        }
                      }
                    }}
                    className="p-2 bg-[var(--surface)] backdrop-blur-md rounded-full text-red-400 hover:bg-red-500 hover:text-[var(--chalk)] transition-all border border-[var(--line)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                        downloadFile(entry.url, `marketing-ad-${entry.id}.mp4`),
                    },
                    {
                      kind: "delete",
                      label: "Delete",
                      danger: true,
                      onSelect: () => {
                        if (confirm("Are you sure you want to delete this generated item?")) {
                          if (!historyItems) {
                            setLocalHistory((prev) =>
                              prev.filter((item) => item.id !== entry.id),
                            );
                          }
                        }
                      },
                    },
                  ]}
                />

                <div className="p-3 bg-[var(--surface)] backdrop-blur-sm border-t border-[var(--line)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-primary px-2 py-0.5 bg-primary/10 rounded border border-primary/20 uppercase tracking-tighter">
                      Marketing Studio
                    </span>
                    {entry.format && (
                      <span className="text-[9px] text-[var(--fog)] font-bold">{entry.format}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ToolShowcase toolId="salesreel" />
        )}
      </div>

      {/* ── BOTTOM PROMPT BAR ── */}
      </div>

      {/* Fullscreen Preview */}
      {fullscreenUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--scrim)] backdrop-blur-sm animate-fade-in" onClick={() => setFullscreenUrl(null)}>
          <button className="absolute top-6 right-6 p-3 bg-[var(--night)] hover:bg-[var(--slab)] rounded-full text-[var(--chalk)] border border-[var(--line)] transition-colors shadow-2xl"><CloseSvg /></button>
          <video src={fullscreenUrl} controls autoPlay className="max-w-[95vw] max-h-[95vh] rounded-lg shadow-4xl animate-scale-up" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── AVATAR FULLSCREEN PREVIEW MODAL ── */}
      {previewAvatar && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--night)] backdrop-blur-md animate-fade-in select-none"
          onClick={() => setPreviewAvatar(null)}
        >
          {/* Close button (cross) in the right corner */}
          <button
            type="button"
            className="absolute top-6 right-6 p-3 bg-[var(--night)] hover:bg-[var(--slab)] rounded-full text-[var(--chalk)] transition-colors border border-[var(--line)] z-50 animate-fade-in"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewAvatar(null);
            }}
          >
            <CloseSvg />
          </button>

          {/* Inject dynamic CSS animation keyframes */}
          <style>{`
            @keyframes slide-in-next {
              0% {
                transform: translateX(80px) scale(0.95);
                filter: blur(4px);
                opacity: 0.5;
              }
              100% {
                transform: translateX(0) scale(1);
                filter: blur(0);
                opacity: 1;
              }
            }
            @keyframes slide-in-prev {
              0% {
                transform: translateX(-80px) scale(0.95);
                filter: blur(4px);
                opacity: 0.5;
              }
              100% {
                transform: translateX(0) scale(1);
                filter: blur(0);
                opacity: 1;
              }
            }
            .animate-slide-next {
              animation: slide-in-next 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .animate-slide-prev {
              animation: slide-in-prev 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>

          {/* Left Arrow Button */}
          {previewAvatar.id !== "custom" && (
            <button
              type="button"
              className="absolute left-6 p-4 bg-[var(--sunk)] hover:bg-[var(--night)] hover:text-primary rounded-full text-[var(--chalk)] transition-all border border-[var(--line)] z-50"
              onClick={(e) => {
                e.stopPropagation();
                const currentIndex = ASSETS.avatar.findIndex(a => a.id === previewAvatar.id);
                if (currentIndex !== -1) {
                  const prevAvatar = ASSETS.avatar[(currentIndex - 1 + ASSETS.avatar.length) % ASSETS.avatar.length];
                  setSlideDirection("prev");
                  setPreviewAvatar(prevAvatar);
                }
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Right Arrow Button */}
          {previewAvatar.id !== "custom" && (
            <button
              type="button"
              className="absolute right-6 p-4 bg-[var(--sunk)] hover:bg-[var(--night)] hover:text-primary rounded-full text-[var(--chalk)] transition-all border border-[var(--line)] z-50"
              onClick={(e) => {
                e.stopPropagation();
                const currentIndex = ASSETS.avatar.findIndex(a => a.id === previewAvatar.id);
                if (currentIndex !== -1) {
                  const nextAvatar = ASSETS.avatar[(currentIndex + 1) % ASSETS.avatar.length];
                  setSlideDirection("next");
                  setPreviewAvatar(nextAvatar);
                }
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Enlarged Image Card and side displays */}
          <div className="flex items-center gap-6 md:gap-12 max-w-[95vw] justify-center relative">
            {/* Previous Avatar Card (Left side) */}
            {previewAvatar.id !== "custom" && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = ASSETS.avatar.findIndex(a => a.id === previewAvatar.id);
                  if (currentIndex !== -1) {
                    const prevAvatar = ASSETS.avatar[(currentIndex - 1 + ASSETS.avatar.length) % ASSETS.avatar.length];
                    setSlideDirection("prev");
                    setPreviewAvatar(prevAvatar);
                  }
                }}
                className="hidden md:flex flex-col items-center opacity-50 hover:opacity-60 scale-75 hover:scale-80 transition-all duration-300 cursor-pointer select-none max-w-[15vw] max-h-[50vh] rounded-xl overflow-hidden border border-[var(--line)] bg-[color-mix(in_srgb,var(--night)_50%,transparent)]"
              >
                <img
                  src={ASSETS.avatar[(ASSETS.avatar.findIndex(a => a.id === previewAvatar.id) - 1 + ASSETS.avatar.length) % ASSETS.avatar.length].url}
                  alt="Previous Avatar"
                  className="w-full h-full object-cover aspect-[3/4]"
                />
              </div>
            )}

            {/* Main Active Avatar Card */}
            <div
              key={previewAvatar.id}
              className={`relative flex flex-col items-center max-w-[90vw] md:max-w-[45vw] max-h-[85vh] z-10 ${
                slideDirection === "next" ? "animate-slide-next" : "animate-slide-prev"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative rounded-2xl overflow-hidden border border-[var(--line)] bg-[var(--night)] shadow-2xl">
                <img
                  src={previewAvatar.url}
                  alt={previewAvatar.name}
                  className="max-w-[80vw] md:max-w-[40vw] max-h-[70vh] md:max-h-[65vh] object-contain"
                />
                
                {/* Overlay with Name of the Avatar */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-10 flex flex-col items-center justify-end gap-3">
                  <h2 className="text-xl font-black text-[var(--chalk)] tracking-wide uppercase">
                    {previewAvatar.name}
                  </h2>
                  
                  {/* Select button on the enlarged image */}
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarImage(previewAvatar.url);
                      setPreviewAvatar(null);
                      setDropdown(null);
                    }}
                    className="bg-[var(--action)] text-[var(--chalk)] px-6 py-2.5 rounded-full font-bold text-sm hover:opacity-95 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[color-mix(in_srgb,var(--action)_20%,transparent)]"
                  >
                    <CheckSvg />
                    Select Avatar
                  </button>
                </div>
              </div>
            </div>

            {/* Next Avatar Card (Right side) */}
            {previewAvatar.id !== "custom" && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = ASSETS.avatar.findIndex(a => a.id === previewAvatar.id);
                  if (currentIndex !== -1) {
                    const nextAvatar = ASSETS.avatar[(currentIndex + 1) % ASSETS.avatar.length];
                    setSlideDirection("next");
                    setPreviewAvatar(nextAvatar);
                  }
                }}
                className="hidden md:flex flex-col items-center opacity-50 hover:opacity-60 scale-75 hover:scale-80 transition-all duration-300 cursor-pointer select-none max-w-[15vw] max-h-[50vh] rounded-xl overflow-hidden border border-[var(--line)] bg-[color-mix(in_srgb,var(--night)_50%,transparent)]"
              >
                <img
                  src={ASSETS.avatar[(ASSETS.avatar.findIndex(a => a.id === previewAvatar.id) + 1) % ASSETS.avatar.length].url}
                  alt="Next Avatar"
                  className="w-full h-full object-cover aspect-[3/4]"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
