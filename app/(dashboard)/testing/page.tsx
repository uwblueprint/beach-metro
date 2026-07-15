"use client";

import { Plus, Square } from "lucide-react";
import { useState } from "react";

import { ListItem } from "@/components/ui/list-item";

const TYPES = ["text", "leading-icon", "trailing-icon"] as const;
const SIZES = ["md", "sm"] as const;

function iconFor(type: (typeof TYPES)[number]) {
  if (type === "leading-icon") return <Square />;
  if (type === "trailing-icon") return <Plus />;
  return undefined;
}

export default function TestingPage() {
  const [activeKey, setActiveKey] = useState<string | null>("md-text");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">List item playground</h1>
        <p className="text-muted-foreground mt-2 text-md">
          Hover for hover state. Click a row to toggle active. Disabled rows are non-interactive.
        </p>
      </div>

      {SIZES.map((size) => (
        <section key={size} className="space-y-4">
          <h2 className="text-lg font-medium">Size: {size}</h2>

          <div className="grid max-w-3xl grid-cols-3 gap-6">
            {TYPES.map((type) => {
              const key = `${size}-${type}`;
              const icon = iconFor(type);

              return (
                <div key={type} className="space-y-2">
                  <p className="text-muted-foreground text-sm">{type}</p>

                  <div className="border-border w-40 space-y-1 rounded-md border p-2">
                    <ListItem
                      size={size}
                      type={type}
                      icon={icon}
                      active={activeKey === key}
                      onClick={() => setActiveKey((prev) => (prev === key ? null : key))}
                    >
                      list item
                    </ListItem>

                    <ListItem size={size} type={type} icon={icon} disabled>
                      list item
                    </ListItem>
                  </div>

                  <p className="text-muted-foreground text-xs">top: clickable · bottom: disabled</p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">All interactive (shared active)</h2>
        <p className="text-muted-foreground text-sm">
          One active at a time — closer to a real nav/list.
        </p>

        <div className="border-border w-56 space-y-0.5 rounded-md border p-2">
          {TYPES.flatMap((type) =>
            SIZES.map((size) => {
              const key = `stack-${size}-${type}`;
              return (
                <ListItem
                  key={key}
                  size={size}
                  type={type}
                  icon={iconFor(type)}
                  active={activeKey === key}
                  onClick={() => setActiveKey(key)}
                >
                  {size} / {type}
                </ListItem>
              );
            }),
          )}
        </div>
      </section>
    </div>
  );
}
