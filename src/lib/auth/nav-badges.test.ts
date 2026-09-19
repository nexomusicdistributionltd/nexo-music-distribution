import { describe, expect, it } from "vitest";
import { applyNavBadgeCounts, navCountForHref } from "@/lib/auth/nav-badges";
import type { NavSection } from "@/lib/auth/nav";

describe("navigation badge counts", () => {
  it("adds route counts without changing navigation destinations", () => {
    const sections: NavSection[] = [
      {
        id: "messages",
        label: "Messages",
        items: [
          { href: "/support", label: "Support" },
          { href: "/dashboard/notifications", label: "Notifications" },
        ],
      },
    ];

    const decorated = applyNavBadgeCounts(sections, {
      routes: { "/support": 3, "/dashboard/notifications": 5 },
      services: {},
    });

    expect(decorated[0].items.map((item) => item.href)).toEqual([
      "/support",
      "/dashboard/notifications",
    ]);
    expect(decorated[0].items[0].count).toBe(3);
    expect(decorated[0].items[1].count).toBe(5);
    expect(navCountForHref({ routes: { "/support": 3 }, services: {} }, "/support")).toBe(3);
  });

  it("uses service-kind counts for generated portal features", () => {
    const sections: NavSection[] = [
      {
        id: "marketing",
        label: "Marketing",
        items: [
          {
            href: "/marketing/fan-blast",
            label: "Fan Blast",
            serviceKind: "fan_blast",
          } as NavSection["items"][number] & { serviceKind: string },
        ],
        groups: [
          [
            {
              href: "/marketing/fan-blast",
              label: "Fan Blast",
              serviceKind: "fan_blast",
            } as NavSection["items"][number] & { serviceKind: string },
          ],
        ],
      },
    ];

    const decorated = applyNavBadgeCounts(sections, {
      routes: {},
      services: { fan_blast: 3 },
    });

    expect(decorated[0].items[0].count).toBe(3);
    expect(decorated[0].groups?.[0][0].count).toBe(3);
  });

  it("does not render zero or invalid counts", () => {
    const sections: NavSection[] = [
      {
        id: "x",
        label: "X",
        items: [{ href: "/x", label: "X" }],
      },
    ];

    const decorated = applyNavBadgeCounts(sections, {
      routes: { "/x": 0 },
      services: {},
    });

    expect(decorated[0].items[0].count).toBeUndefined();
  });
});
