import type { SettingsDto, SettingsFormValues } from "@munim/core";
import type { HttpClient } from "../http.js";

export function settings(http: HttpClient) {
  return {
    /** GET /api/settings — mirrors core `getSettings(db)`. */
    get(): Promise<SettingsDto> {
      return http.get("/api/settings");
    },
    /** PUT /api/settings — mirrors core `updateSettings(db, values)`. */
    update(values: SettingsFormValues): Promise<SettingsDto> {
      return http.put("/api/settings", values);
    },
  };
}

export type SettingsEndpoints = ReturnType<typeof settings>;
