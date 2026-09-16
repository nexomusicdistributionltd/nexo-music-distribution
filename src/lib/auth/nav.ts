import type { AppRole } from "@/lib/auth/types";
import { hasAdminPermission } from "@/lib/admin/permissions";

export type NavIconId =
  | "overview"
  | "catalog"
  | "release"
  | "distribution"
  | "roster"
  | "qc"
  | "ddex"
  | "publishing"
  | "finance"
  | "analytics"
  | "messages"
  | "notifications"
  | "newsletter"
  | "website"
  | "users"
  | "audit"
  | "settings"
  | "profile"
  | "support"
  | "search"
  | "compliance"
  | "email";

export type NavItem = {
  href: string;
  label: string;
  icon?: NavIconId;
};

export type NavSection = {
  id: string;
  label: string;
  collapsible?: boolean;
  items: NavItem[];
};

export type WorkspaceKind = "admin" | "label" | "artist";

export function workspaceKindForRoles(roles: AppRole[]): WorkspaceKind {
  if (roles.includes("super_admin") || roles.includes("admin") || roles.includes("support")) {
    return "admin";
  }
  if (roles.includes("label")) return "label";
  return "artist";
}

export function flattenNav(sections: NavSection[]): NavItem[] {
  const seen = new Set<string>();
  const items: NavItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      items.push(item);
    }
  }
  return items;
}

const ADMIN_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ href: "/admin", label: "Overview", icon: "overview" }],
  },
  {
    id: "catalog",
    label: "Catalog",
    collapsible: true,
    items: [{ href: "/admin/releases", label: "Releases", icon: "catalog" }],
  },
  {
    id: "people",
    label: "People",
    collapsible: true,
    items: [
      { href: "/admin/artists", label: "Artists", icon: "users" },
      { href: "/admin/labels", label: "Labels", icon: "roster" },
      { href: "/admin/users", label: "Users", icon: "users" },
    ],
  },
  {
    id: "distribution",
    label: "Distribution",
    collapsible: true,
    items: [
      { href: "/admin/distribution", label: "Distribution", icon: "distribution" },
      { href: "/admin/ddex", label: "DDEX", icon: "ddex" },
      { href: "/admin/playlist-pitches", label: "Playlist pitches", icon: "distribution" },
    ],
  },
  {
    id: "qc",
    label: "Quality",
    items: [{ href: "/admin/qc", label: "QC Queue", icon: "qc" }],
  },
  {
    id: "publishing",
    label: "Publishing",
    items: [{ href: "/admin/publishing", label: "Publishing", icon: "publishing" }],
  },
  {
    id: "finance",
    label: "Finance",
    collapsible: true,
    items: [
      { href: "/admin/finance", label: "Finance", icon: "finance" },
      { href: "/admin/royalties", label: "Royalties", icon: "finance" },
      { href: "/admin/statements", label: "Statements", icon: "finance" },
      { href: "/admin/payouts", label: "Payouts", icon: "finance" },
      { href: "/admin/finance/billing", label: "Billing", icon: "finance" },
      { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
    ],
  },
  {
    id: "messages",
    label: "Messages",
    collapsible: true,
    items: [
      { href: "/admin/support", label: "Support", icon: "support" },
      { href: "/admin/notifications", label: "Notifications", icon: "notifications" },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    collapsible: true,
    items: [
      { href: "/admin/emails", label: "Inbox", icon: "email" },
      { href: "/admin/contact", label: "Website Messages", icon: "messages" },
      { href: "/admin/emails/compose", label: "Compose Email", icon: "email" },
      { href: "/admin/emails/templates", label: "Email Templates", icon: "email" },
      { href: "/admin/emails/automated", label: "Automated Emails", icon: "email" },
      { href: "/admin/emails/sent", label: "Sent", icon: "email" },
      { href: "/admin/emails/failed", label: "Failed / Delivery Issues", icon: "email" },
      { href: "/admin/emails/activity", label: "Email Activity", icon: "email" },
      { href: "/admin/newsletter", label: "Newsletter", icon: "newsletter" },
    ],
  },
  {
    id: "website",
    label: "Website",
    collapsible: true,
    items: [
      { href: "/admin/website", label: "Website", icon: "website" },
      { href: "/admin/partners", label: "Partners", icon: "website" },
      { href: "/admin/blog", label: "Blog", icon: "website" },
      { href: "/admin/pages", label: "Pages", icon: "website" },
      { href: "/admin/videos", label: "Videos", icon: "website" },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    collapsible: true,
    items: [
      { href: "/admin/compliance", label: "Compliance", icon: "compliance" },
      { href: "/admin/search", label: "Search", icon: "search" },
      { href: "/admin/reports", label: "Reports", icon: "audit" },
      { href: "/admin/audit", label: "Audit", icon: "audit" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [{ href: "/admin/settings", label: "Settings", icon: "settings" }],
  },
];

function artistSections(): NavSection[] {
  return [
    {
      id: "overview",
      label: "Workspace",
      items: [{ href: "/dashboard", label: "Overview", icon: "overview" }],
    },
    {
      id: "catalog",
      label: "Catalog",
      collapsible: true,
      items: [
        { href: "/dashboard/releases", label: "Releases", icon: "catalog" },
        { href: "/dashboard/catalog", label: "Catalog", icon: "catalog" },
        { href: "/dashboard/catalog/move-in", label: "Move In", icon: "catalog" },
        { href: "/dashboard/playlist-pitch", label: "Playlist pitching", icon: "distribution" },
      ],
    },
    {
      id: "distribution",
      label: "Distribution",
      items: [{ href: "/dashboard/releases/new", label: "New release", icon: "release" }],
    },
    {
      id: "finance",
      label: "Finance",
      collapsible: true,
      items: [
        { href: "/earnings", label: "Royalties", icon: "finance" },
        { href: "/billing", label: "Plan & billing", icon: "finance" },
        { href: "/app/publishing", label: "Publishing", icon: "publishing" },
      ],
    },
    {
      id: "messages",
      label: "Inbox",
      collapsible: true,
      items: [
        { href: "/support", label: "Messages", icon: "messages" },
        { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
      ],
    },
    {
      id: "account",
      label: "Account",
      collapsible: true,
      items: [
        { href: "/dashboard/profile", label: "Profile", icon: "profile" },
        { href: "/dashboard/settings", label: "Settings", icon: "settings" },
      ],
    },
  ];
}

function labelSections(): NavSection[] {
  return [
    {
      id: "overview",
      label: "Workspace",
      items: [{ href: "/dashboard", label: "Overview", icon: "overview" }],
    },
    {
      id: "roster",
      label: "Roster",
      items: [{ href: "/app/artists", label: "Roster", icon: "roster" }],
    },
    {
      id: "catalog",
      label: "Catalog",
      collapsible: true,
      items: [
        { href: "/dashboard/releases", label: "Releases", icon: "catalog" },
        { href: "/dashboard/catalog", label: "Catalog", icon: "catalog" },
        { href: "/dashboard/catalog/move-in", label: "Move In", icon: "catalog" },
        { href: "/dashboard/playlist-pitch", label: "Playlist pitching", icon: "distribution" },
      ],
    },
    {
      id: "distribution",
      label: "Distribution",
      items: [{ href: "/dashboard/releases/new", label: "New release", icon: "release" }],
    },
    {
      id: "finance",
      label: "Finance",
      collapsible: true,
      items: [
        { href: "/earnings", label: "Royalties", icon: "finance" },
        { href: "/billing", label: "Plan & billing", icon: "finance" },
        { href: "/app/publishing", label: "Publishing", icon: "publishing" },
      ],
    },
    {
      id: "messages",
      label: "Inbox",
      collapsible: true,
      items: [
        { href: "/support", label: "Messages", icon: "messages" },
        { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
      ],
    },
    {
      id: "account",
      label: "Label",
      collapsible: true,
      items: [
        { href: "/dashboard/profile", label: "Label profile", icon: "profile" },
        { href: "/dashboard/settings", label: "Settings", icon: "settings" },
      ],
    },
  ];
}

export function navSectionsForRoles(roles: AppRole[]): NavSection[] {
  const kind = workspaceKindForRoles(roles);
  if (kind === "admin") {
    return ADMIN_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.href === "/admin/settings") {
          return hasAdminPermission(roles, "admin:settings");
        }
        return true;
      }),
    })).filter((section) => section.items.length > 0);
  }
  if (kind === "label") return labelSections();
  return artistSections();
}

/** Flat destinations for tests and compact consumers. */
export function navForRoles(roles: AppRole[]): NavItem[] {
  return flattenNav(navSectionsForRoles(roles));
}

export function titleForPath(pathname: string, sections: NavSection[]): string {
  const items = flattenNav(sections);
  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact.label;
  const nested = items
    .filter((item) => item.href !== "/admin" && item.href !== "/dashboard" && item.href !== "/support")
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return nested?.label ?? "Workspace";
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/dashboard") {
    return pathname === href;
  }
  if (href === "/support") {
    return pathname === href || pathname.startsWith("/support?");
  }
  if (href === "/dashboard/catalog") {
    return pathname === "/dashboard/catalog";
  }
  if (href === "/dashboard/releases") {
    if (pathname === "/dashboard/releases/new") return false;
    return pathname === "/dashboard/releases" || pathname.startsWith("/dashboard/releases/");
  }
  if (href === "/dashboard/releases/new") {
    return pathname === "/dashboard/releases/new";
  }
  if (href === "/admin/finance") {
    return pathname === "/admin/finance";
  }
  if (href === "/admin/emails") {
    return pathname === "/admin/emails" || pathname.startsWith("/admin/emails/inbox");
  }
  if (href === "/admin/contact") {
    return pathname === href || pathname.startsWith(`${href}?`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
