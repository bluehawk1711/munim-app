"use client"

/**
 * Web parties (khata) / advances / payments hooks — thin re-exports of the
 * shared @munim/query hooks. `useRecordPayment` is aliased to the shared
 * party-payment hook (the shared package splits invoice vs party payments).
 */
import {
  useParties,
  usePartyBalances,
  useParty,
  useCreateParty,
  useUpdateParty,
  useDeleteParty,
  useAdvances,
  useCreateAdvance,
  usePayments,
  useRecordPartyPayment,
} from "@munim/query"

export {
  useParties,
  usePartyBalances,
  useParty,
  useCreateParty,
  useUpdateParty,
  useDeleteParty,
  useAdvances,
  useCreateAdvance,
  usePayments,
}
export { useRecordPartyPayment as useRecordPayment }
