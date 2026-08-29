"use client";

import React, { useState, useEffect } from 'react';
import { 
  FaUserTie, FaImage, FaMagic, FaVideo, FaFileAlt, 
  FaBriefcase, FaHome, FaMicrophone, FaHandSparkles, FaBuilding,
  FaUserInjured, FaStethoscope, FaCar, FaPaw, FaBalanceScale, FaTruck, FaMapMarkerAlt,
  FaGithub, FaExternalLinkAlt, FaDollarSign, FaRocket, FaCreditCard 
} from "react-icons/fa";
import { registerAppInterest, getAppInterests } from '../muapi.js';
import toast, { Toaster } from 'react-hot-toast';

const templateApps = [
  {
    name: "AI Headshot Studio",
    description: "Turn one selfie into a set of clean, professional headshots.",
    icon: FaUserTie,
    color: "blue",
    isTemplate: true
  },
  {
    name: "Batch Picture Studio",
    description: "Make a batch of pictures in one go, all in the same style.",
    icon: FaHandSparkles,
    color: "amber",
    isTemplate: true
  },
  {
    name: "Art Director",
    description: "Fine control over style, lighting and composition for artwork.",
    icon: FaMagic,
    color: "purple",
    isTemplate: true
  },
  {
    name: "AI Clipping Studio",
    description: "Paste a long video link and get the best short clips from it.",
    icon: FaVideo,
    color: "emerald",
    isTemplate: true
  },
  {
    name: "All-in-One Video",
    description: "One place for every way of making a video: words, a photo, or a reference clip.",
    icon: FaVideo,
    color: "indigo",
    isTemplate: true
  }
];

const dummyAppsData = [
  { name: "Pet Product Studio", description: "High-end product photography specifically for pet toys and food.", icon: FaPaw, category: "Lifestyle" },
  { name: "Resale Photo Enhancer", description: "Boost sales by elevating low-quality product photos to studio level.", icon: FaImage, category: "Business" },
  { name: "AI Recruiter", description: "Smart candidate screening and interview assistant.", icon: FaBriefcase, category: "Business" },
  { name: "Talk to PDF", description: "Interactive document chat for deep research and summarization.", icon: FaFileAlt, category: "Productivity" },
  { name: "Blogger CMS", description: "AI-powered content management for high-velocity SEO blogs.", icon: FaBriefcase, category: "Business" },
  { name: "Amazon Product Studio", description: "Perfect Amazon-ready product shots with AI backdrops.", icon: FaImage, category: "Business" },
  { name: "AI Business Card", description: "Digital-first business card generator with AI networking.", icon: FaBriefcase, category: "Business" },
  { name: "MailWise", description: "Intelligent email drafting and scheduling assistant.", icon: FaBriefcase, category: "Business" },
  { name: "My Podcast", description: "Automated podcast editing and show-note generation.", icon: FaMicrophone, category: "Creative" },
  { name: "EZScribe", description: "Instant transcription and meeting minute automation.", icon: FaFileAlt, category: "Productivity" },
  { name: "AI Knowledge Base", description: "Train an AI on your company data for instant support.", icon: FaBriefcase, category: "Business" },
  { name: "AI Outbound", description: "Personalized cold outreach at scale for sales teams.", icon: FaBriefcase, category: "Business" },
  { name: "AI Royal Portrait", description: "Transform your photos into 18th-century royal oil paintings.", icon: FaHandSparkles, category: "Creative" },
  { name: "AI MEME", description: "Viral-ready meme generation based on trending topics.", icon: FaMagic, category: "Creative" },
  { name: "AI Real Estate Stager", description: "Virtually furnish and stage empty homes for sale.", icon: FaHome, category: "Real Estate" },
  { name: "AI Logo", description: "Dynamic brand identity and logo generator.", icon: FaHandSparkles, category: "Business" },
  { name: "OldPhoto", description: "Restore, colorize, and sharpen vintage family photos.", icon: FaImage, category: "Creative" },
  { name: "AITryOn", description: "Virtual fitting room for fashion brands and enthusiasts.", icon: FaHandSparkles, category: "Lifestyle" },
  { name: "AI Age Transformation", description: "Visualize yourself at different stages of life with high fidelity.", icon: FaImage, category: "Lifestyle" },
  { name: "AI Professional Makeup Generator", description: "Try on hundreds of makeup looks virtually.", icon: FaHandSparkles, category: "Lifestyle" },
  { name: "AI Flash Cards", description: "Turn any text or PDF into pedagogical flashcards.", icon: FaFileAlt, category: "Education" },
  { name: "AI Group Photo", description: "Seamlessly combine individual portraits into a group photo.", icon: FaImage, category: "Creative" },
  { name: "AI Tattoo Try-On", description: "Visualize tattoos on your body before getting inked.", icon: FaHandSparkles, category: "Lifestyle" },
  { name: "AI Hair Style Simulator", description: "Try on new haircuts and colors with zero commitment.", icon: FaHandSparkles, category: "Lifestyle" },
  { name: "AI Kids-to-Adult Prediction", description: "Ever wonder what your kid will look like as an adult?", icon: FaImage, category: "Lifestyle" },
  { name: "AI Room Declutter", description: "Instantly clean up messy room photos for listings.", icon: FaHome, category: "Real Estate" },
  { name: "AI Fitness Body Simulator", description: "Visualize your fitness goals on your own body.", icon: FaImage, category: "Lifestyle" },
  { name: "AI Pet Portrait", description: "Elegant, artistic portraits for your beloved pets.", icon: FaPaw, category: "Lifestyle" },
  { name: "AI Kissing Video Generator", description: "Expressive AI video generation for romantic moments.", icon: FaVideo, category: "Creative" },
  { name: "Chat with PDF", description: "Ask questions and extract data from massive PDF files.", icon: FaFileAlt, category: "Productivity" },
  { name: "AI Travel Studio", description: "Create stunning travel posters and visuals from prompts.", icon: FaMapMarkerAlt, category: "Lifestyle" },
  { name: "Prompt Architect", description: "Refine and optimize complex prompts for high-tier AI models.", icon: FaMagic, category: "Creative" },
  { name: "ClearMark AI", description: "Automated watermark removal and brand cleanup for assets.", icon: FaImage, category: "Business" },
  { name: "PlantVision AI", description: "Identify plants and generate gardening care guides.", icon: FaHandSparkles, category: "Lifestyle" },
  { name: "AI Wedding Photo", description: "Cinematic wedding photography enhancements and filters.", icon: FaImage, category: "Lifestyle" },
  { name: "User Account Registration Form", description: "Beautiful, conversion-optimized signup flows.", icon: FaBriefcase, category: "Development" },
  { name: "Social Post", description: "AI-generated social media scheduling and copy creator.", icon: FaBriefcase, category: "Marketing" },
  { name: "MagicSelf AI", description: "The ultimate AI selfie and avatar generation engine.", icon: FaMagic, category: "Creative" },
  { name: "AI Resume Builder", description: "Craft the perfect, ATS-friendly resume in seconds.", icon: FaFileAlt, category: "Productivity" },
  { name: "GEO Checker", description: "AI-powered location tagging and geodata validation.", icon: FaMapMarkerAlt, category: "Business" },
  { name: "AI Character Studio", description: "Consistent character design for animators and writers.", icon: FaUserTie, category: "Creative" },
  { name: "Luxury Hair Studio", description: "High-end hair visualization for top-tier salons.", icon: FaHandSparkles, category: "Lifestyle" },
  { name: "ProFlow Plumbing", description: "AI scheduling and diagnostics for plumbing services.", icon: FaHome, category: "Services" },
  { name: "Solace AI", description: "Empathetic AI assistant for mental well-being support.", icon: FaHandSparkles, category: "Health" },
  { name: "ReLive AI", description: "Immersive memory and historical visualization engine.", icon: FaHandSparkles, category: "Creative" },
  { name: "AI Chiropractic Service", description: "Postural analysis and exercise recommendation AI.", icon: FaUserInjured, category: "Health" },
  { name: "Tabla - ReserveAI", description: "Intelligent table reservation engine for restaurants.", icon: FaBuilding, category: "Services" },
  { name: "Dental ReserveAI", description: "Smart dental appointment and follow-up management.", icon: FaStethoscope, category: "Health" },
  { name: "CounselMate", description: "Legal research and document drafting aid for lawyers.", icon: FaBalanceScale, category: "Legal" },
  { name: "Intelligent Real Estate Agent", description: "Automate leads and property matches with AI agents.", icon: FaHome, category: "Real Estate" },
  { name: "Fixera", description: "Home repair diagnosis and pro-finding ecosystem.", icon: FaHome, category: "Services" },
  { name: "Velora - Yoga AI", description: "Personalized AI yoga and posture guidance engine.", icon: FaHandSparkles, category: "Health" },
  { name: "Nova AssuranceAI", description: "Smart insurance quote and claim processing assistant.", icon: FaBalanceScale, category: "Legal" },
  { name: "TurboGlow Auto Spa", description: "AI booking and customization for luxury auto detailing.", icon: FaCar, category: "Services" },
  { name: "Paws & Pals", description: "AI-powered pet care and walking coordination hub.", icon: FaPaw, category: "Lifestyle" },
  { name: "Vertex Tax Strategy", description: "Intelligent tax planning and deduction spotting AI.", icon: FaBalanceScale, category: "Business" },
  { name: "LedgerSync", description: "Automated bookkeeping and financial reconciliations.", icon: FaBriefcase, category: "Business" },
  { name: "Nova Care Clinic", description: "Patient scheduling and medical intake automation.", icon: FaStethoscope, category: "Health" },
  { name: "Opulent Drive", description: "Luxury car rental and fleet management AI.", icon: FaCar, category: "Services" },
  { name: "ProFix Auto", description: "Engine diagnostics and preventive maintenance alerts.", icon: FaCar, category: "Services" },
  { name: "TowMate", description: "Smart roadside assistance and dispatch coordination.", icon: FaTruck, category: "Services" },
  { name: "SwiftLink Logistics", description: "AI route optimization and fleet tracking system.", icon: FaTruck, category: "Services" },
  { name: "Lumea Residence", description: "Smart home property management and tenant portal.", icon: FaHome, category: "Real Estate" }
];

/**
 * Every category on the shelf, with how many tools sit in it. Derived rather
 * than written down, so adding a tool above cannot leave the panel stale.
 */
const CATEGORIES = (() => {
  const counts = new Map();
  for (const app of dummyAppsData) counts.set(app.category, (counts.get(app.category) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
})();

export default function AppsStudio({ apiKey }) {
  const [selectedApp, setSelectedApp] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestedApps, setRequestedApps] = useState([]);
  // Fifty-two tools in one flat grid is a wall. The panel narrows it.
  const [category, setCategory] = useState('All');

  useEffect(() => {
    if (apiKey) {
      getAppInterests(apiKey)
        .then(setRequestedApps)
        .catch(err => console.error("Error fetching interests:", err));
    }
  }, [apiKey]);

  const handleRequestAccess = async () => {
    if (!selectedApp || !apiKey) return;
    
    setIsRequesting(true);
    try {
      await registerAppInterest(apiKey, selectedApp.name);
      setRequestedApps(prev => [...prev, selectedApp.name]);
      toast.success("Got it! We'll send you the template details shortly.");
      setTimeout(() => setSelectedApp(null), 1500);
    } catch (error) {
      console.error(error);
      toast.error("Failed to register interest. Please try again later.");
    } finally {
      setIsRequesting(false);
    }
  };

  const renderAppCard = (app, isDummy = false, index = 0) => {
    // Premium Vibrant Gradients for placeholders
    const gradients = [
      "from-blue-600/20 to-indigo-600/20",
      "from-purple-600/20 to-pink-600/20",
      "from-amber-500/20 to-orange-600/20",
      "from-emerald-500/20 to-teal-600/20",
      "from-rose-500/20 to-red-600/20",
      "from-cyan-500/20 to-blue-600/20",
    ];
    const cardGradient = gradients[index % gradients.length];
    
    return (
      <div 
        key={app.name}
        className="group bg-[var(--night)] border border-[var(--line)] rounded-lg flex flex-col overflow-hidden transition-all duration-300 hover:border-[var(--line)] hover:bg-[var(--night)] hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1"
      >
        {/* Thumbnail Section */}
        <div className="relative h-44 w-full overflow-hidden bg-[var(--sunk)]">
          {app.thumbnail ? (
            <img
              src={app.thumbnail}
              alt={app.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${cardGradient} transition-colors group-hover:scale-110 duration-700`}>
              <app.icon className={`text-4xl opacity-20 group-hover:opacity-40 transition-opacity text-[var(--chalk)]`} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        </div>

        {/* Content Section */}
        <div className="p-5 flex flex-col flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--sunk)] flex items-center justify-center text-lg text-[var(--chalk)] border border-[var(--line)] group-hover:border-[var(--line)] transition-colors">
              <app.icon />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[var(--chalk)] uppercase tracking-tight truncate">{app.name}</h3>
              <p className="text-[10px] text-[var(--fog)] font-bold uppercase tracking-widest">{app.category || 'Template'}</p>
            </div>
          </div>
          
          <p className="text-xs text-[var(--steel)] leading-relaxed font-medium line-clamp-2 min-h-[2.5rem]">{app.description}</p>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {requestedApps.includes(app.name) ? (
              <span className="flex-1 py-2 rounded-tag text-[11px] font-semibold text-center bg-[var(--sunk)] text-[var(--fog)] border border-[var(--line)]">
                Voted — thank you
              </span>
            ) : (
              <button
                onClick={() => setSelectedApp(app)}
                className="flex-1 py-2 rounded-tag text-[11px] font-semibold bg-[var(--action)] text-[var(--chalk)] hover:bg-[var(--slab-hi)] transition-colors active:scale-95"
              >
                I would use this
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const shown = category === 'All'
    ? dummyAppsData
    : dummyAppsData.filter((app) => app.category === category);

  return (
    <div className="h-full w-full flex flex-col lg:flex-row bg-[var(--night)] relative">
      <Toaster position="bottom-right" reverseOrder={false} />

      {/* ── LEFT PANEL ──
          App Shelf is the one tool that generates nothing, so it has no
          settings and no price. What it does have is fifty-two entries, which
          is exactly the case a panel is for: narrow the shelf, and see how many
          of your votes are already counted. */}
      <aside className="w-full lg:w-[370px] shrink-0 bg-[var(--sunk)] border-b lg:border-b-0 lg:border-r border-[var(--line)] flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 flex flex-col gap-6">
          <div>
            <h2 className="text-[10.5px] font-medium uppercase tracking-[.14em] text-[var(--fog)] mb-3">
              Browse the shelf
            </h2>
            <div className="flex flex-col gap-1">
              {[{ name: 'All', count: dummyAppsData.length }, ...CATEGORIES].map((entry) => {
                const active = category === entry.name;
                return (
                  <button
                    key={entry.name}
                    type="button"
                    onClick={() => setCategory(entry.name)}
                    aria-pressed={active}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-tag text-left text-[13px] transition-colors border ${
                      active
                        ? 'bg-[var(--slab-hi)] border-[var(--peri)] text-[var(--chalk)] font-semibold'
                        : 'bg-transparent border-transparent text-[var(--steel)] hover:bg-[var(--slab)] hover:text-[var(--chalk)]'
                    }`}
                  >
                    <span>{entry.name}</span>
                    <span className="tabular-nums text-[11px] text-[var(--fog)]">{entry.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-[10.5px] font-medium uppercase tracking-[.14em] text-[var(--fog)] mb-3">
              Your votes
            </h2>
            {requestedApps.length === 0 ? (
              <p className="text-[12.5px] leading-relaxed text-[var(--steel)]">
                Nothing yet. Tap “I would use this” on any tool — voting is free and
                costs no credits.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {requestedApps.map((name) => (
                  <li key={name} className="flex items-start gap-2 text-[12.5px] text-[var(--paper-ink)] leading-snug">
                    <span aria-hidden className="text-[var(--lilac)] mt-[1px]">✓</span>
                    <span>{name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--line)] px-5 py-4">
          <p className="text-[11.5px] leading-relaxed text-[var(--fog)]">
            Nothing on this page is charged. The most requested tools are built first.
          </p>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center">
      <div className="flex flex-col gap-10 items-center w-full max-w-7xl pt-12 pb-24 px-6">
        
        {/* Header Section */}
        <div className="text-center space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--indigo)] rounded-tag">
            <span className="text-[10px] font-semibold text-[var(--chalk)] uppercase tracking-widest">Coming next</span>
          </div>
          <h1 className="text-[40px] font-semibold text-[var(--chalk)] tracking-tight leading-[1.1]">
            What should we build next?
          </h1>
          <p className="text-[var(--fog)] text-sm leading-relaxed max-w-xl mx-auto">
            These are the tools we are considering. Tap the ones you would use and we will
            build the most wanted first. Voting is free and costs no credits.
          </p>
        </div>

        {/* Monetization Steps */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: FaRocket,
              step: "01",
              title: "Tap what you want",
              body: "Every tap is a vote. Pick as many as you like — nothing is charged."
            },
            {
              icon: FaCreditCard,
              step: "02",
              title: "We build the top ones",
              body: "The most requested tools go into the build queue first."
            },
            {
              icon: FaDollarSign,
              step: "03",
              title: "You get told",
              body: "When something you voted for is ready, it appears in your tools."
            }
          ].map(({ icon: Icon, step, title, body }) => (
            <div key={step} className="flex items-start gap-4 bg-[var(--night)] border border-[var(--line)] rounded-2xl p-6 hover:border-[var(--line)] transition-colors">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-[var(--sunk)] flex items-center justify-center text-[var(--chalk)] border border-[var(--line)]">
                <Icon className="text-lg" />
              </div>
              <div>
                <p className="text-[10px] font-black text-[var(--fog)] uppercase tracking-widest mb-1">Step {step}</p>
                <h3 className="text-sm font-bold text-[var(--chalk)] mb-1.5">{title}</h3>
                <p className="text-xs text-[var(--fog)] leading-relaxed font-medium">{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full pt-8">
          {category === 'All' && templateApps.map((app, index) => renderAppCard(app, false, index))}
          {shown.map((app, index) => renderAppCard(app, true, index + templateApps.length))}
        </div>

        {/* Footer Accent */}
        <div className="pt-24 pb-12 flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-[var(--sunk)] rounded-full border border-[var(--line)]">
            <span className="block w-1.5 h-1.5 rounded-full bg-[var(--action)] animate-pulse" />
            <span className="text-[9px] font-black text-[var(--fog)] uppercase tracking-widest">More tools on the way</span>
          </div>
        </div>
      </div>
      </div>

      {/* Get Template Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-[var(--surface)] backdrop-blur-sm animate-fade-in" onClick={() => setSelectedApp(null)} />
          <div className="relative bg-[var(--night)] border border-[var(--line)] w-full max-w-md rounded-2xl p-8 space-y-8 animate-scale-up shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-[28px] bg-[color-mix(in_srgb,var(--action)_10%,transparent)] border border-[color-mix(in_srgb,var(--line-hi)_20%,transparent)] flex items-center justify-center text-4xl text-[var(--chalk)] mb-2">
                <selectedApp.icon />
              </div>
              <h2 className="text-2xl font-black text-[var(--chalk)] uppercase tracking-tight">
                Vote for {selectedApp.name}
              </h2>
              <p className="text-sm font-medium text-[var(--fog)] leading-relaxed px-4">
                We will count your vote for <b>{selectedApp.name}</b>. The most requested tools get built first, and we will tell you when this one is ready.
              </p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleRequestAccess}
                disabled={isRequesting}
                className="w-full py-4 bg-[var(--action)] text-[var(--chalk)] rounded-md text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[color-mix(in_srgb,var(--action)_90%,transparent)] transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isRequesting ? 'Sending Details...' : 'Get Template'}
              </button>
              <button 
                onClick={() => setSelectedApp(null)}
                className="w-full py-4 bg-[var(--sunk)] border border-[var(--line)] text-[var(--steel)] rounded-md text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[var(--night)] transition-all"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
