import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * `clsx` flattens conditionals; `twMerge` resolves conflicts, so a component's
 * default `px-4` loses cleanly to a caller's `px-2` instead of both landing in
 * the class list and the cascade deciding by declaration order.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
