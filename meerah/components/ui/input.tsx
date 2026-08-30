import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The base input. Styling lives on the bare `input` element in globals.css —
 * recessed fill, hairline edge, accent border on focus — so a plain `<input>`
 * and this component look identical. This exists for the ref and the class
 * merge, not to restate the design.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn('disabled:cursor-not-allowed', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export { Input };
