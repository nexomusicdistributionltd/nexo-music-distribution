import type { AppRole } from "@/lib/auth/types";

export type NavItem = { href: string; label: string };

export function navForRoles(roles: AppRole[]): NavItem[] {
  if (roles.includes("super_admin") || roles.includes("admin")) {
    return [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/releases", label: "Releases" },
      { href: "/admin/qc", label: "QC" },
      { href: "/admin/catalog", label: "Catalog" },
      { href: "/admin/reports", label: "Reports" },
      { href: "/admin/audit-logs", label: "Audit Logs" },
      { href: "/admin/settings", label: "Settings" },
    ];
  }

  if (roles.includes("support")) {
    return [
      { href: "/support", label: "Support" },
      { href: "/dashboard/profile", label: "Profile" },
    ];
  }

  if (roles.includes("label")) {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/releases", label: "Releases" },
      { href: "/dashboard/catalog", label: "Catalog" },
      { href: "/dashboard/releases/new", label: "Create" },
      { href: "/app/artists", label: "Artists" },
      { href: "/earnings", label: "Earnings" },
      { href: "/analytics", label: "Analytics" },
      { href: "/app/publishing", label: "Publishing" },
      { href: "/dashboard/notifications", label: "Notifications" },
      { href: "/dashboard/profile", label: "Profile" },
      { href: "/dashboard/settings", label: "Settings" },
      { href: "/support", label: "Support" },
    ];
  }

  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/releases", label: "Releases" },
    { href: "/dashboard/catalog", label: "Catalog" },
    { href: "/dashboard/releases/new", label: "Create" },
    { href: "/earnings", label: "Earnings" },
    { href: "/analytics", label: "Analytics" },
    { href: "/app/publishing", label: "Publishing" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/profile", label: "Profile" },
    { href: "/dashboard/settings", label: "Settings" },
    { href: "/support", label: "Support" },
  ];
}
