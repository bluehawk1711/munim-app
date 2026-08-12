/**
 * SettingsShell — shared sectioned settings layout (macOS System Settings /
 * iOS Settings style), used by BOTH the web and desktop apps so the settings
 * page stays pixel-identical across platforms.
 *
 * Layout:
 *   - lg+      : left glass sidebar with icon + label rows (active row gets a
 *                primary-tint pill) and a content pane on the right.
 *   - < lg     : the sidebar collapses into a horizontally scrollable row of
 *                chips; content stacks below.
 *
 * The content pane is keyed by the active section, so switching sections
 * replays a short fade/slide entrance (motion-reduce safe).
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
export type SettingsSection = {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    /** Optional short status chip on the right of the row (e.g. "On"/"1234"). */
    badge?: string;
};
type SettingsShellProps = {
    sections: SettingsSection[];
    active: string;
    onSelect: (id: string) => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
};
export declare function SettingsShell({ sections, active, onSelect, title, subtitle, children, }: SettingsShellProps): React.JSX.Element;
/** Enter animation used by the content pane when switching sections. */
export declare const SETTINGS_SECTION_CSS = "\n@keyframes munim-settings-enter {\n  from { opacity: 0; transform: translateY(8px); }\n  to { opacity: 1; transform: translateY(0); }\n}\n.settings-section-enter { animation: munim-settings-enter 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }\n@media (prefers-reduced-motion: reduce) {\n  .settings-section-enter { animation: none; }\n}\n";
export {};
//# sourceMappingURL=settings-shell.d.ts.map