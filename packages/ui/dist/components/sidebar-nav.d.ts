/**
 * SidebarNav / SidebarBrand / SidebarFooter — the ONE sidebar design used by
 * both web and desktop (web's sectioned layout: grouped destinations, one-line
 * descriptions, and an active pill). Apps only supply their destination list,
 * the active key, and a navigate callback; they never re-style the sidebar.
 */
import * as React from "react";
export type SidebarNavItem<K extends string = string> = {
    key: K;
    label: string;
    icon: React.ComponentType<{
        className?: string;
    }>;
    description: string;
};
export type SidebarNavSection<K extends string = string> = {
    label: string;
    items: SidebarNavItem<K>[];
};
export declare function SidebarNav<K extends string>({ sections, activeKey, onNavigate, }: {
    sections: readonly SidebarNavSection<K>[];
    activeKey: string;
    onNavigate: (key: K) => void;
}): React.JSX.Element;
export declare function SidebarBrand({ title, subtitle, }: {
    title?: string;
    subtitle?: string;
}): React.JSX.Element;
export declare function SidebarFooter({ note }: {
    note?: string;
}): React.JSX.Element;
//# sourceMappingURL=sidebar-nav.d.ts.map