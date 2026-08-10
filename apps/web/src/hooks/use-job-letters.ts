"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { JobLetter } from "@/lib/types"

export function useJobLetters() {
  return useQuery({
    queryKey: ["job-letters"],
    queryFn: () => apiFetch<JobLetter[]>("/api/job-letters"),
  })
}

export function useSaveJobLetter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: { title: string; employeeName?: string; position?: string; monthlySalary?: number; data: Record<string, unknown> }) =>
      apiFetch<JobLetter>("/api/job-letters", { method: "POST", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-letters"] })
    },
  })
}
