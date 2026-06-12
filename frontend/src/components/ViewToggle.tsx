"use client";

/* Grid / list view switch for dashboard collections. Styled like the
   period picker in the creator-dashboard design sample (cd-period). */

import Icon from "@/components/Icon";

export type ViewMode = "grid" | "list";

export default function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const options: { id: ViewMode; icon: string; label: string }[] = [
    { id: "grid", icon: "layout-grid", label: "Grid view" },
    { id: "list", icon: "list", label: "List view" },
  ];

  return (
    <div className="cd-period" role="group" aria-label="Switch layout">
      {options.map(o => (
        <button
          key={o.id}
          className={view === o.id ? "is-on" : ""}
          onClick={() => onChange(o.id)}
          aria-label={o.label}
          aria-pressed={view === o.id}
          title={o.label}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Icon name={o.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
