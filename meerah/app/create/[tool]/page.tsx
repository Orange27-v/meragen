import { notFound } from 'next/navigation';
import { TOOLS, toolById } from '@/lib/tools';
import StudioHost from '@/components/studio/StudioHost';

/** Every tool gets a real URL, so it can be linked to and bookmarked. */
export function generateStaticParams() {
  return TOOLS.map((tool) => ({ tool: tool.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const tool = toolById((await params).tool);
  return tool
    ? { title: `${tool.label} — Meerah`, description: tool.blurb }
    : {};
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!toolById(tool)) notFound();
  return <StudioHost toolId={tool} />;
}
