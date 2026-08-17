import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { JobLetterDto, JobLetterFormValues } from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/** GET /api/job-letters. */
export function useJobLetters() {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.jobLetters.all,
    queryFn: async () => {
      const api = await getClient();
      return api.jobLetters.list();
    },
  });
}

/** POST /api/job-letters. */
export function useSaveJobLetter() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: JobLetterFormValues): Promise<JobLetterDto> => {
      const api = await getClient();
      return api.jobLetters.create(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.jobLetters.all });
    },
  });
}

/** DELETE /api/job-letters/:id. */
export function useDeleteJobLetter() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.jobLetters.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.jobLetters.all });
    },
  });
}
