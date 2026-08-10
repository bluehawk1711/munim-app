"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { DashboardStats, ReportData, ReportType } from "@/lib/types"

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardStats>("/api/dashboard"),
  })
}

export function useReport(type: ReportType | null, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["report", type, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set("type", type!)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      return apiFetch<ReportData>(`/api/reports?${params.toString()}`)
    },
    enabled: !!type,
    staleTime: 5 * 60 * 1000,
  })
}
