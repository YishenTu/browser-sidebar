import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge CSS classes with Tailwind CSS conflict resolution.
 *
 * This function combines clsx for conditional class handling and tailwind-merge
 * for Tailwind CSS class conflict resolution.
 *
 * @param inputs - Array of class values (strings, objects, arrays, etc.)
 * @returns Merged and deduplicated class string
 *
 * @example
 * ```tsx
 * cn('btn', 'btn-primary', className) // Merges base classes with custom
 * cn('bg-red-500', 'bg-blue-500') // Returns 'bg-blue-500' (last wins)
 * cn('px-2', isActive && 'bg-blue-500') // Conditional classes
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
