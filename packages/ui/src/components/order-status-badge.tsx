"use client"

/**
 * Shared order status badge — the exact same color mapping in the web and
 * desktop order lists: OPEN (blue), COMPLETED (emerald), CANCELLED (muted).
 */
import { cn } from "../lib/utils";
import { Badge } from "./badge";

export type OrderStatus = "OPEN" | "COMPLETED" | "CANCELLED";

const STATUS_STYLES: Record<OrderStatus, string> = {
  OPEN: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CANCELLED: "border-muted bg-muted/50 text-muted-foreground",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: "Open",
  COMPLETED: "Billed",
  CANCELLED: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge className={cn("font-normal", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
