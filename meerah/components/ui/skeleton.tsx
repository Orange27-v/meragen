import { cn } from '@/lib/utils';

/** A placeholder shaped like the thing it stands in for, never a spinner. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded bg-secondary', className)} {...props} />;
}

export { Skeleton };
