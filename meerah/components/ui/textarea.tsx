import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * An input keeps its resting line. It is the one control where a stroke says
 * "type here" — without it a field and the card behind it are the same shape.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[92px] w-full rounded bg-transparent px-3 py-2.5 text-sm text-foreground',
        'border border-input placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-45 resize-none transition-colors',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
