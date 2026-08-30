import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * shadcn's variants, rewritten against Meerah's tokens so this and the plain
 * `.btn` classes in globals.css produce the same control. Two changes from
 * stock: `default` is the mint accent rather than shadcn's near-white primary,
 * and `destructive` is outlined rather than filled — a filled red button is the
 * loudest thing on a dark ground, and deleting a saved character does not
 * deserve to be louder than generating a video.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md font-medium ' +
    'leading-none transition-[background-color,border-color,color,box-shadow,transform] ' +
    'duration-200 ease-ease ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-surface-base disabled:pointer-events-none disabled:opacity-40 ' +
    'active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-mint text-mint-ink font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_rgba(0,0,0,0.35)] hover:bg-mint-hover active:bg-mint-press',
        secondary:   'border border-edge bg-surface-raised text-ink-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-edge-strong hover:bg-surface-hover',
        outline:     'border border-edge bg-transparent text-ink-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-edge-strong hover:bg-surface-hover',
        ghost:       'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary',
        destructive: 'border border-edge bg-transparent text-danger hover:border-danger hover:bg-danger-wash',
        link:        'text-mint underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5 text-base',
        sm:      'h-[30px] px-[11px] text-sm',
        lg:      'h-11 px-5 text-md',
        icon:    'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
