"use client";

// The tools we serve. Workflows, Agents, Design Agent and the CLI/MCP kit are
// deliberately out: the first three need separate submodules and 20-30 backend
// endpoints, and all four serve developers or power users rather than the
// vendors, agents and agencies this product is for.
export { default as VideoStudio } from './components/VideoStudio';
export { default as ImageStudio } from './components/ImageStudio';
export { default as LipSyncStudio } from './components/LipSyncStudio';
export { default as MarketingStudio } from './components/MarketingStudio';
export { default as CinemaStudio } from './components/CinemaStudio';
export { default as AudioStudio } from './components/AudioStudio';
export { default as LayersStudio } from './components/LayersStudio';
export { default as ClippingStudio } from './components/ClippingStudio';
export { default as VibeMotionStudio } from './components/VibeMotionStudio';
export { default as RecastStudio } from './components/RecastStudio';
export { default as AiInfluencerStudio } from './components/AiInfluencerStudio';
export * from './meerah';

// The empty-state showcase, plus the setter the app uses to hand it tool copy.
export { default as ToolShowcase, setShowcase } from './components/rail/ToolShowcase';
