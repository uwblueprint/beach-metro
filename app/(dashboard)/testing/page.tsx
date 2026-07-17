"use client";

import { ChevronDown, Plus, Square, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { PillGroup } from "@/components/ui/pill-group";
import { SearchBar } from "@/components/ui/search-bar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListItem } from "@/components/ui/list-item";

// ─── Section components ───────────────────────────────────────────────────────
// To add a new component section:
//   1. Define it as a component below (stateless sections need no props).
//   2. Add one entry to SECTIONS at the bottom of this file.

const BUTTON_VARIANTS = ["default", "primary", "outline", "danger", "text"] as const;
const BUTTON_SIZES = ["sm", "default", "lg"] as const;

function ButtonsSection() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Buttons</h1>
        <p className="text-secondary mt-2 text-md">
          All variant × size × state combinations from the Figma design system.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Text only</h2>
        <div className="space-y-6">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="space-y-2">
              <p className="text-secondary text-sm font-medium">{variant}</p>
              <div className="flex items-center gap-3">
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    Button Text
                  </Button>
                ))}
                {BUTTON_SIZES.map((size) => (
                  <Button key={`${size}-d`} variant={variant} size={size} disabled>
                    Disabled
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Leading icon</h2>
        <div className="space-y-6">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="space-y-2">
              <p className="text-secondary text-sm font-medium">{variant}</p>
              <div className="flex items-center gap-3">
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    <Plus data-icon="inline-start" />
                    Button Text
                  </Button>
                ))}
                {BUTTON_SIZES.map((size) => (
                  <Button key={`${size}-d`} variant={variant} size={size} disabled>
                    <Plus data-icon="inline-start" />
                    Disabled
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Trailing icon</h2>
        <div className="space-y-6">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="space-y-2">
              <p className="text-secondary text-sm font-medium">{variant}</p>
              <div className="flex items-center gap-3">
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    Button Text
                    <ChevronDown data-icon="inline-end" />
                  </Button>
                ))}
                {BUTTON_SIZES.map((size) => (
                  <Button key={`${size}-d`} variant={variant} size={size} disabled>
                    Disabled
                    <ChevronDown data-icon="inline-end" />
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Icon only</h2>
        <div className="space-y-6">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="space-y-2">
              <p className="text-secondary text-sm font-medium">{variant}</p>
              <div className="flex items-center gap-3">
                <Button variant={variant} size="icon-sm">
                  <Plus />
                </Button>
                <Button variant={variant} size="icon">
                  <Plus />
                </Button>
                <Button variant={variant} size="icon-lg">
                  <Plus />
                </Button>
                <Button variant={variant} size="icon-sm" disabled>
                  <Trash2 />
                </Button>
                <Button variant={variant} size="icon" disabled>
                  <Trash2 />
                </Button>
                <Button variant={variant} size="icon-lg" disabled>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Link variant</h2>
        <div className="flex items-center gap-4">
          <Button variant="link" size="sm">
            Small link
          </Button>
          <Button variant="link">Default link</Button>
          <Button variant="link" size="lg">
            Large link
          </Button>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type PillsSectionProps = {
  exclusivePill: string | null;
  setExclusivePill: (v: string | null) => void;
  multiPills: string[];
  setMultiPills: (v: string[]) => void;
};

function PillsSection({
  exclusivePill,
  setExclusivePill,
  multiPills,
  setMultiPills,
}: PillsSectionProps) {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Pills</h1>
        <p className="text-secondary mt-2 text-md">
          Display variants, interactive states, exclusive and multi-select groups.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Display variants</h2>
        <div className="flex flex-wrap gap-2">
          <Pill variant="default">Default</Pill>
          <Pill variant="active">Active</Pill>
          <Pill variant="success">Success</Pill>
          <Pill variant="warning">Warning</Pill>
          <Pill variant="danger">Danger</Pill>
          <Pill variant="disabled">Disabled</Pill>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Pill group — exclusive</h2>
        <p className="text-secondary text-sm">
          Selecting one deselects the current. Click selected to deselect.
        </p>
        <PillGroup
          exclusive
          value={exclusivePill}
          onChange={setExclusivePill}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "retired", label: "Retired" },
          ]}
        />
        <p className="text-secondary text-xs">Selected: {exclusivePill ?? "none"}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Pill group — multi-select</h2>
        <p className="text-secondary text-sm">Each pill toggles independently.</p>
        <PillGroup
          value={multiPills}
          onChange={setMultiPills}
          options={[
            { value: "success", label: "Paid" },
            { value: "warning", label: "Partial" },
            { value: "danger", label: "Unpaid" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
        <p className="text-secondary text-xs">
          Selected: {multiPills.length ? multiPills.join(", ") : "none"}
        </p>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const LIST_TYPES = ["text", "leading-icon", "trailing-icon"] as const;
const LIST_SIZES = ["md", "sm"] as const;

function iconFor(type: (typeof LIST_TYPES)[number]) {
  if (type === "leading-icon") return <Square />;
  if (type === "trailing-icon") return <Plus />;
  return undefined;
}

type ListItemsSectionProps = {
  activeKey: string | null;
  setActiveKey: (updater: (prev: string | null) => string | null) => void;
};

function ListItemsSection({ activeKey, setActiveKey }: ListItemsSectionProps) {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">List items</h1>
        <p className="text-secondary mt-2 text-md">
          Hover for hover state. Click a row to toggle active. Disabled rows are non-interactive.
        </p>
      </div>

      {LIST_SIZES.map((size) => (
        <section key={size} className="space-y-4">
          <h2 className="text-lg font-medium">Size: {size}</h2>
          <div className="grid max-w-3xl grid-cols-3 gap-6">
            {LIST_TYPES.map((type) => {
              const key = `${size}-${type}`;
              const icon = iconFor(type);
              return (
                <div key={type} className="space-y-2">
                  <p className="text-secondary text-sm">{type}</p>
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
                  <p className="text-secondary text-xs">top: clickable · bottom: disabled</p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">All interactive (shared active)</h2>
        <p className="text-secondary text-sm">One active at a time — closer to a real nav/list.</p>
        <div className="border-border w-56 space-y-0.5 rounded-md border p-2">
          {LIST_TYPES.flatMap((type) =>
            LIST_SIZES.map((size) => {
              const key = `stack-${size}-${type}`;
              return (
                <ListItem
                  key={key}
                  size={size}
                  type={type}
                  icon={iconFor(type)}
                  active={activeKey === key}
                  onClick={() => setActiveKey(() => key)}
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

// ─────────────────────────────────────────────────────────────────────────────

const PAYMENT_YEARS = [
  "2025-26 Payments",
  "2024-25 Payments (archived)",
  "2023-24 Payments (archived)",
  "2022-23 Payments (archived)",
  "2021-22 Payments (archived)",
  "2020-21 Payments (archived)",
] as const;

type DropdownsSectionProps = {
  paymentYear: string;
  setPaymentYear: (v: string) => void;
  showStatusBar: boolean;
  setShowStatusBar: (v: boolean) => void;
  showActivityBar: boolean;
  setShowActivityBar: (v: boolean) => void;
  showPanel: boolean;
  setShowPanel: (v: boolean) => void;
};

function DropdownsSection({
  paymentYear,
  setPaymentYear,
  showStatusBar,
  setShowStatusBar,
  showActivityBar,
  setShowActivityBar,
  showPanel,
  setShowPanel,
}: DropdownsSectionProps) {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Dropdowns</h1>
        <p className="text-secondary mt-2 text-md">
          Open each menu to inspect hover/highlight, checked, disabled, destructive, and submenu
          states.
        </p>
      </div>

      <div className="flex flex-wrap gap-8">
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Basic items</h2>
          <p className="text-secondary text-sm">
            Label, separator, shortcut, disabled, destructive.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Open menu
              <ChevronDown className="size-4 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuItem>
                  Profile<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Billing<DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Settings<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>GitHub</DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuItem disabled>API (disabled)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Delete account</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Radio (checked)</h2>
          <p className="text-secondary text-sm">
            Selected row uses active-grey — Figma payments years.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              {paymentYear}
              <ChevronDown className="size-4 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56">
              <DropdownMenuRadioGroup value={paymentYear} onValueChange={setPaymentYear}>
                {PAYMENT_YEARS.map((year) => (
                  <DropdownMenuRadioItem key={year} value={year}>
                    {year}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-secondary text-xs">Selected: {paymentYear}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Checkbox</h2>
          <p className="text-secondary text-sm">Checked items keep active-grey + check mark.</p>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Appearance
              <ChevronDown className="size-4 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-48">
              <DropdownMenuLabel>Panels</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={showStatusBar} onCheckedChange={setShowStatusBar}>
                Status Bar
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showActivityBar}
                onCheckedChange={setShowActivityBar}
              >
                Activity Bar
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showPanel} onCheckedChange={setShowPanel}>
                Panel
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-secondary text-xs">
            {[showStatusBar && "status", showActivityBar && "activity", showPanel && "panel"]
              .filter(Boolean)
              .join(", ") || "none"}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Submenu</h2>
          <p className="text-secondary text-sm">
            Sub-trigger open/highlight states + nested content.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              With submenu
              <ChevronDown className="size-4 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-44">
              <DropdownMenuItem>New Tab</DropdownMenuItem>
              <DropdownMenuItem>New Window</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Email</DropdownMenuItem>
                  <DropdownMenuItem>Messages</DropdownMenuItem>
                  <DropdownMenuItem disabled>Notes (disabled)</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Close</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type SearchBarSectionProps = {
  searchValue: string;
  setSearchValue: (v: string) => void;
};

function SearchBarSection({ searchValue, setSearchValue }: SearchBarSectionProps) {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Search bar</h1>
        <p className="text-secondary mt-2 text-md">
          Controlled search input with clear text. Type to see the clear control appear.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Default</h2>
        <div className="max-w-md">
          <SearchBar value={searchValue} onChange={setSearchValue} placeholder="Search by name" />
        </div>
        <p className="text-secondary text-xs">
          Value: {searchValue ? `"${searchValue}"` : "(empty)"}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Disabled</h2>
        <div className="max-w-md">
          <SearchBar value="" onChange={() => {}} placeholder="Disabled search" disabled />
        </div>
      </section>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestingPage() {
  const [activeKey, setActiveKey] = useState<string | null>("md-text");
  const [paymentYear, setPaymentYear] = useState<string>(PAYMENT_YEARS[0]);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [showActivityBar, setShowActivityBar] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [exclusivePill, setExclusivePill] = useState<string | null>("active");
  const [multiPills, setMultiPills] = useState<string[]>(["success", "warning"]);
  const [searchValue, setSearchValue] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // ── Add new sections here — pill nav updates automatically ──────────────────
  const sections: { value: string; label: string; content: React.ReactNode }[] = [
    {
      value: "buttons",
      label: "Buttons",
      content: <ButtonsSection />,
    },
    {
      value: "pills",
      label: "Pills",
      content: (
        <PillsSection
          exclusivePill={exclusivePill}
          setExclusivePill={setExclusivePill}
          multiPills={multiPills}
          setMultiPills={setMultiPills}
        />
      ),
    },
    {
      value: "list-items",
      label: "List items",
      content: <ListItemsSection activeKey={activeKey} setActiveKey={setActiveKey} />,
    },
    {
      value: "dropdowns",
      label: "Dropdowns",
      content: (
        <DropdownsSection
          paymentYear={paymentYear}
          setPaymentYear={setPaymentYear}
          showStatusBar={showStatusBar}
          setShowStatusBar={setShowStatusBar}
          showActivityBar={showActivityBar}
          setShowActivityBar={setShowActivityBar}
          showPanel={showPanel}
          setShowPanel={setShowPanel}
        />
      ),
    },
    {
      value: "search",
      label: "Search bar",
      content: <SearchBarSection searchValue={searchValue} setSearchValue={setSearchValue} />,
    },
  ];
  // ── ─────────────────────────────────────────────────────────────────────────

  const filteredSections = sections.filter((s) =>
    s.label.toLowerCase().includes(sectionFilter.toLowerCase()),
  );

  const activeStillVisible =
    activeSection != null && filteredSections.some((s) => s.value === activeSection);

  const visible = activeStillVisible
    ? filteredSections.filter((s) => s.value === activeSection)
    : filteredSections;

  return (
    <div className="page-container">
      <div className="page">
        <div className="flex h-full flex-col">
          <div className="page-header-container">
            <div className="flex items-center gap-2">
              <h1 className="text-md text-primary">Component playground</h1>
              <p className="text-secondary text-md">Press ? from anywhere to open</p>
            </div>
          </div>

          <div className="border-border flex flex-col gap-3 border-b py-4 pr-4 pl-6">
            <SearchBar
              value={sectionFilter}
              onChange={setSectionFilter}
              placeholder="Search components"
            />
            <PillGroup
              exclusive
              value={activeSection}
              onChange={setActiveSection}
              options={filteredSections.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-16 overflow-y-auto p-6">
            {visible.map((s) => (
              <div key={s.value}>{s.content}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
