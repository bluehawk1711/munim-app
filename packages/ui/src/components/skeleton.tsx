import { cn } from "../lib/utils.js"

/**
 * Shimmer skeleton — a premium left-to-right sheen instead of the classic
 * pulse. The gradient + keyframes live in @munim/theme's generated tokens.css
 * (`.skeleton-shimmer`), so web and desktop render identically and a new theme
 * needs no changes here.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
