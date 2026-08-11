"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  Undo2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  MoreHorizontal,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@munim/ui"




import { EmptyState } from "@/components/app/shared"
import { formatCurrency, formatDateTime } from "@/lib/format"
import type { Sale } from "@/lib/types"

type Props = {
  sales: Sale[]
  onUndo: (sale: Sale) => void
}

export function SalesTable({ sales, onUndo }: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }])

  const columns = React.useMemo<ColumnDef<Sale>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.original.invoiceNumber}</span>
        ),
      },
      {
        accessorKey: "productName",
        header: ({ column }) => (
          <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Product <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.productName}</span>
            <span className="text-xs text-muted-foreground">{row.original.sku}</span>
          </div>
        ),
      },
      {
        accessorKey: "color",
        header: "Color",
        cell: ({ row }) => <Badge variant="outline" className="font-normal">{row.original.color}</Badge>,
      },
      {
        accessorKey: "size",
        header: "Size",
        cell: ({ row }) => <span>{row.original.size}</span>,
      },
      {
        accessorKey: "quantity",
        header: ({ column }) => (
          <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Qty <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <span className="tabular-nums">×{row.original.quantity}</span>,
      },
      {
        accessorKey: "sellingPrice",
        header: "Unit Price",
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatCurrency(row.original.sellingPrice)}</span>,
      },
      {
        accessorKey: "total",
        header: ({ column }) => (
          <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Total <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.total)}</span>,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Date <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Sale actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onUndo(row.original)}
                  className="text-amber-600 focus:text-amber-600 dark:text-amber-400"
                >
                  <Undo2 className="mr-2 h-4 w-4" /> Undo sale
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [onUndo]
  )

  const table = useReactTable({
    data: sales,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  if (sales.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No sales found"
        description="Try adjusting your search or date range, or record a new sale."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/40">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="h-10 text-xs">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/30">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {sales.length} sales
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-8">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-8">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
