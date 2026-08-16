"use client"

import * as React from "react"
import Image from "next/image"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Trash2,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Package,
  Tag,
  Eye,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, BarcodeSvg } from "@munim/ui"




import { StockBadge, EmptyState } from "@/components/app/shared"
import { formatCurrency, formatDate, formatWeight } from "@/lib/format"
import type { Product } from "@/lib/types"

type Props = {
  products: Product[]
  onEdit: (product: Product) => void
  onAdjust: (product: Product) => void
  onDelete: (product: Product) => void
  onSell: (product: Product) => void
  onPrintLabel: (product: Product) => void
  onViewDetails: (product: Product) => void
  pagination?: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  onPageChange?: (page: number) => void
}

export function ProductsTable({ products, onEdit, onAdjust, onDelete, onSell, onPrintLabel, onViewDetails, pagination, onPageChange }: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }])

  const columns = React.useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-medium hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Product <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex items-center gap-3">
              {p.imageUrl ? (
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                  <Package className="h-4 w-4" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.sku}
                  {p.category ? ` · ${p.category}` : ""}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "barcode",
        header: "Barcode",
        cell: ({ row }) => {
          const b = row.original.barcode
          return b ? (
            <BarcodeSvg value={b} height={30} scale={1} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: "color",
        header: ({ column }) => (
          <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Color <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <span>{row.original.color}</span>,
      },
      {
        accessorKey: "weight",
        header: "Weight",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatWeight(row.original.weight)}
          </span>
        ),
      },
      {
        accessorKey: "size",
        header: "Size",
        cell: ({ row }) => <span>{row.original.size}</span>,
      },
      {
        accessorKey: "stock",
        header: ({ column }) => (
          <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Stock <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex flex-col gap-1">
              <span className="font-medium tabular-nums">{p.stock}</span>
              <StockBadge stock={p.stock} />
            </div>
          )
        },
      },
      {
        accessorKey: "purchasePrice",
        header: "Purchase",
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatCurrency(row.original.purchasePrice)}</span>,
      },
      {
        accessorKey: "sellingPrice",
        header: ({ column }) => (
          <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Selling <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.sellingPrice)}</span>,
      },
      {
        accessorKey: "createdAt",
        header: "Added",
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => onSell(p)}
                disabled={p.stock <= 0}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sell</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Product actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onViewDetails(p)}>
                    <Eye className="mr-2 h-4 w-4" /> View details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(p)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit product
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAdjust(p)}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" /> Adjust stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSell(p)} disabled={p.stock <= 0}>
                    <ShoppingCart className="mr-2 h-4 w-4" /> Sell this item
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPrintLabel(p)}>
                    <Tag className="mr-2 h-4 w-4" /> Print label
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(p)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [onEdit, onAdjust, onDelete, onSell, onPrintLabel, onViewDetails]
  )

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No products found"
        description="Try adjusting your search or filters, or add a new product to get started."
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
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          {pagination
            ? `Showing ${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of ${pagination.totalCount} products`
            : `${products.length} product${products.length !== 1 ? "s" : ""}`
          }
        </p>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="h-8"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
