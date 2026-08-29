/**
 * The tool catalogue — names, descriptions and grouping.
 *
 * Deliberately free of any `import` from the studio package. The header renders
 * this list on every signed-in page, and pulling a studio component in here
 * would drag several megabytes of generation code onto pages that never
 * generate anything. `/create` maps these ids to components separately.
 *
 * The blurbs are what a customer reads before spending money, so they say what
 * the tool makes in plain words — not what it is built from.
 */
export interface ToolInfo {
  id: string;
  label: string;
  blurb: string;
  group: ToolGroup;
  /** Which price applies. Drives the Quality column of the nav menu. */
  kind: 'video' | 'image' | 'lipsync' | 'upscale' | 'audio' | 'none';
}

export type ToolGroup = 'Video' | 'Image' | 'People' | 'Selling' | 'More';

export const GROUPS: ToolGroup[] = ['Video', 'Image', 'People', 'Selling', 'More'];

export const TOOLS: ToolInfo[] = [
  { id: 'videngine',  label: 'VidEngine',    group: 'Video',   kind: 'video',
    blurb: 'Turn a line of text or a photo into a video' },
  { id: 'vibereel',   label: 'Vibe Reel',    group: 'Video',   kind: 'video',
    blurb: 'Add movement to a still photo in one tap' },
  { id: 'shotdirect', label: 'ShotDirector', group: 'Video',   kind: 'video',
    blurb: 'Describe a scene and get it shot by shot' },
  { id: 'snipreel',   label: 'Snip Reel',    group: 'Video',   kind: 'video',
    blurb: 'Cut a long video into short clips' },

  { id: 'pixcraft',   label: 'PixCraft',     group: 'Image',   kind: 'image',
    blurb: 'Product shots, flyers and thumbnails' },
  { id: 'patchup',    label: 'Patch Up',     group: 'Image',   kind: 'image',
    blurb: 'Edit a picture, replace parts, split it into layers' },

  { id: 'talksync',   label: 'TalkSync',     group: 'People',  kind: 'lipsync',
    blurb: 'Make a face speak your script' },
  { id: 'bodydouble', label: 'Body Double',  group: 'People',  kind: 'video',
    blurb: 'Keep the face, change the body and the clothes' },
  { id: 'starmaker',  label: 'Star Maker',   group: 'People',  kind: 'image',
    blurb: 'Build one face that stays the same in every post' },

  { id: 'salesreel',  label: 'Sales Reel',   group: 'Selling', kind: 'video',
    blurb: 'Advert-ready video for Instagram and TikTok' },
  { id: 'soundtrack', label: 'SoundTrack',   group: 'Selling', kind: 'audio',
    blurb: 'Background music and voiceover for your videos' },

  { id: 'appshelf',   label: 'App Shelf',    group: 'More',    kind: 'none',
    blurb: 'Vote on what we build next' },
];

export function toolById(id: string): ToolInfo | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsInGroup(group: ToolGroup): ToolInfo[] {
  return TOOLS.filter((t) => t.group === group);
}
