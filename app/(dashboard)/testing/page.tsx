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
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogField,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogWizardFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banner } from "@/components/ui/banner";
import { Checkbox, CheckboxIcon } from "@/components/ui/checkbox";

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
            Selected row uses active-grey; hover uses lighter tag-hover.
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
          <p className="text-secondary text-sm">
            Left checkbox toggles with selection; row uses hover only (no selected fill).
          </p>
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

const CAPTAIN_OPTIONS = ["Lena Morales", "James Chen", "Priya Patel", "Sam Okonkwo"] as const;
const ROLE_OPTIONS = [
  { value: "captain", label: "Captain" },
  { value: "volunteer", label: "Volunteer" },
  { value: "commercial", label: "Commercial drop" },
] as const;

const inputTriggerClassName =
  "flex h-auto w-full cursor-pointer items-center justify-between gap-2 rounded-[8px] border border-hairline bg-bg px-3 py-2 text-left text-md text-primary outline-none transition-colors focus-visible:border-active focus-visible:ring-3 focus-visible:ring-active/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-disabled disabled:opacity-50";

function InputsSection() {
  const [captain, setCaptain] = useState<string>(CAPTAIN_OPTIONS[0]);
  const [roles, setRoles] = useState<string[]>(["captain", "volunteer"]);

  function toggleRole(value: string, checked: boolean) {
    setRoles((prev) => (checked ? [...prev, value] : prev.filter((v) => v !== value)));
  }

  const roleLabel =
    ROLE_OPTIONS.filter((o) => roles.includes(o.value))
      .map((o) => o.label)
      .join(", ") || "Select roles…";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-balance">Input</h1>
        <p className="text-secondary mt-2 text-md text-pretty">
          Text field, dropdown, and multiselect — Figma Input styling (border/hairline, body/md, 8px
          radius). Compose with Label for Input Group.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Text</h2>
        <div className="grid max-w-md gap-6">
          <div className="space-y-2">
            <p className="text-secondary text-sm font-medium">Placeholder</p>
            <Input
              id="input-state-default"
              name="demo-default"
              aria-label="Placeholder"
              placeholder="Input text"
            />
          </div>
          <div className="space-y-2">
            <p className="text-secondary text-sm font-medium">Filled</p>
            <Input
              id="input-state-filled"
              name="demo-filled"
              aria-label="Filled"
              defaultValue="Lena Morales"
            />
          </div>
          <div className="space-y-2">
            <p className="text-secondary text-sm font-medium">Disabled</p>
            <Input
              id="input-state-disabled"
              name="demo-disabled"
              aria-label="Disabled"
              placeholder="Input text"
              disabled
            />
          </div>
          <div className="space-y-2">
            <p className="text-secondary text-sm font-medium">Invalid</p>
            <Input
              id="input-state-invalid"
              name="demo-invalid"
              aria-label="Invalid"
              placeholder="Input text"
              aria-invalid
              defaultValue="bad@"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Dropdown</h2>
        <p className="text-secondary text-sm">
          Single-select field trigger — same Input shell, menu from DropdownMenu.
        </p>
        <div className="grid max-w-md gap-6">
          <div className="flex flex-col gap-2">
            <Label id="input-captain-label" className="text-md font-normal text-primary">
              Captain
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" className={inputTriggerClassName} />}
                aria-labelledby="input-captain-label"
              >
                <span className="min-w-0 truncate">{captain}</span>
                <ChevronDown className="size-3 shrink-0 text-primary" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[var(--anchor-width)]">
                <DropdownMenuRadioGroup value={captain} onValueChange={setCaptain}>
                  {CAPTAIN_OPTIONS.map((name) => (
                    <DropdownMenuRadioItem key={name} value={name}>
                      {name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-2">
            <Label id="input-drop-label" className="text-md font-normal text-primary">
              Drop Details
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" className={inputTriggerClassName} />}
                aria-labelledby="input-drop-label"
              >
                <span className="min-w-0 truncate text-secondary">Input text</span>
                <ChevronDown className="size-3 shrink-0 text-primary" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[var(--anchor-width)]">
                <DropdownMenuItem>123 Queen St</DropdownMenuItem>
                <DropdownMenuItem>187 Queen St</DropdownMenuItem>
                <DropdownMenuItem disabled>Create new address…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-md font-normal text-primary">Disabled</Label>
            <button type="button" className={inputTriggerClassName} disabled>
              <span className="min-w-0 truncate text-secondary">Input text</span>
              <ChevronDown className="size-3 shrink-0" />
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Multiselect</h2>
        <p className="text-secondary text-sm">
          Left-aligned checkbox on an Input-styled trigger, or PillGroup for inline multi-select.
        </p>
        <div className="grid max-w-md gap-6">
          <div className="flex flex-col gap-2">
            <Label id="input-roles-label" className="text-md font-normal text-primary">
              Roles
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" className={inputTriggerClassName} />}
                aria-labelledby="input-roles-label"
              >
                <span
                  className={`min-w-0 truncate ${roles.length ? "text-primary" : "text-secondary"}`}
                >
                  {roleLabel}
                </span>
                <ChevronDown className="size-3 shrink-0 text-primary" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[var(--anchor-width)]">
                {ROLE_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={roles.includes(option.value)}
                    onCheckedChange={(checked) => toggleRole(option.value, Boolean(checked))}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="text-secondary text-xs">
              Selected: {roles.length ? roles.join(", ") : "none"}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-md font-normal text-primary">Roles (pills)</Label>
            <PillGroup
              value={roles}
              onChange={setRoles}
              options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Input Group</h2>
        <p className="text-secondary text-sm">
          Label + text Input with 8px gap — matches Figma Input Group.
        </p>
        <div className="grid max-w-md gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="input-semantic" className="text-md font-normal text-primary">
              Semantic Name
            </Label>
            <Input
              id="input-semantic"
              name="semantic-name"
              defaultValue="Queen St E · Woodbine → Coxwell"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="input-disabled-labeled" className="text-md font-normal text-primary">
              Email
            </Label>
            <Input
              id="input-disabled-labeled"
              name="email-disabled"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              spellCheck={false}
              disabled
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="input-invalid-labeled" className="text-md font-normal text-primary">
              Username
            </Label>
            <Input
              id="input-invalid-labeled"
              name="username"
              placeholder="username…"
              aria-invalid
              aria-describedby="input-invalid-labeled-hint"
              defaultValue="ab"
              spellCheck={false}
              autoComplete="username"
            />
            <p id="input-invalid-labeled-hint" className="text-destructive text-xs">
              Must be at least 3 characters.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Native types</h2>
        <div className="grid max-w-md gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="input-email" className="text-md font-normal text-primary">
              Email
            </Label>
            <Input
              id="input-email"
              name="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="input-password" className="text-md font-normal text-primary">
              Password
            </Label>
            <Input
              id="input-password"
              name="password"
              type="password"
              placeholder="Password…"
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="input-number" className="text-md font-normal text-primary">
              Number
            </Label>
            <Input
              id="input-number"
              name="quantity"
              type="number"
              inputMode="numeric"
              placeholder="0"
              className="tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="input-file" className="text-md font-normal text-primary">
              File
            </Label>
            <Input id="input-file" name="file" type="file" />
          </div>
        </div>
      </section>
    </div>
  );
}

const WIZARD_TITLES = [
  "New Member: Basic Details",
  "New Member: Contact Details",
  "New Member: Payment Details",
] as const;

function DialogsSection() {
  const [wizardStep, setWizardStep] = useState(1);
  const wizardSteps = WIZARD_TITLES.length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-balance">Dialog</h1>
        <p className="text-secondary mt-2 text-md text-pretty">
          Three-segment modal shell (header / body / footer). Use DialogWizardFooter for multi-step
          flows — step label left, Cancel/Back + Next/Confirm right.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">New Territory Drop</h2>
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Territory Drop</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <DialogField>
                <Label htmlFor="dialog-captain" className="text-md font-normal text-primary">
                  Captain
                </Label>
                <div className="relative">
                  <Input id="dialog-captain" defaultValue="Lena Morales" className="pr-8" />
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-primary" />
                </div>
              </DialogField>
              <DialogField>
                <Label htmlFor="dialog-drop" className="text-md font-normal text-primary">
                  Drop Details
                </Label>
                <div className="relative">
                  <Input id="dialog-drop" placeholder="Input text" className="pr-8" />
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-primary" />
                </div>
              </DialogField>
              <DialogDescription>
                By confirming, any selected drop with an existing territory will be re-allocated.
                All drop information, such as bundle and paper count, will persist.
              </DialogDescription>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button variant="default" />}>Cancel</DialogClose>
              <DialogClose render={<Button variant="primary" />}>Confirm</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Confirm only</h2>
        <Dialog>
          <DialogTrigger render={<Button variant="danger" />}>Open confirm</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete route?</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <DialogDescription>
                Soft-deletes the route from active workflows. The route disappears from lists
                immediately.
              </DialogDescription>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button variant="default" />}>Cancel</DialogClose>
              <DialogClose render={<Button variant="danger" />}>Delete</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Wizard (multi-step)</h2>
        <p className="text-secondary text-sm">
          Step 1: Cancel + Next · middle: Back + Next · last: Back + Confirm.
        </p>
        <Dialog
          onOpenChange={(open) => {
            if (open) setWizardStep(1);
          }}
        >
          <DialogTrigger render={<Button variant="outline" />}>Open wizard</DialogTrigger>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {WIZARD_TITLES[wizardStep - 1] ?? WIZARD_TITLES[0]}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              {wizardStep === 1 ? (
                <>
                  <DialogField>
                    <Label htmlFor="wizard-role" className="text-md font-normal text-primary">
                      Role
                    </Label>
                    <div className="relative">
                      <Input id="wizard-role" defaultValue="Volunteer" className="pr-8" />
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-primary" />
                    </div>
                  </DialogField>
                  <DialogField>
                    <Label htmlFor="wizard-first" className="text-md font-normal text-primary">
                      First Name
                    </Label>
                    <Input id="wizard-first" placeholder="Input text" />
                  </DialogField>
                  <DialogField>
                    <Label htmlFor="wizard-last" className="text-md font-normal text-primary">
                      Last Name
                    </Label>
                    <Input id="wizard-last" placeholder="Input text" />
                  </DialogField>
                </>
              ) : null}
              {wizardStep === 2 ? (
                <>
                  <DialogField>
                    <Label htmlFor="wizard-email" className="text-md font-normal text-primary">
                      Email Address
                    </Label>
                    <Input
                      id="wizard-email"
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      spellCheck={false}
                    />
                  </DialogField>
                  <DialogField>
                    <Label htmlFor="wizard-phone" className="text-md font-normal text-primary">
                      Phone
                    </Label>
                    <Input id="wizard-phone" type="tel" placeholder="Input text" />
                  </DialogField>
                </>
              ) : null}
              {wizardStep === 3 ? (
                <>
                  <DialogField>
                    <Label htmlFor="wizard-pay-type" className="text-md font-normal text-primary">
                      Pay Type
                    </Label>
                    <Input id="wizard-pay-type" placeholder="Input text" />
                  </DialogField>
                  <DialogField>
                    <Label htmlFor="wizard-pay-rate" className="text-md font-normal text-primary">
                      Pay Rate
                    </Label>
                    <div className="relative">
                      <Input id="wizard-pay-rate" placeholder="Input text" className="pr-8" />
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-primary" />
                    </div>
                  </DialogField>
                  <DialogField>
                    <Label htmlFor="wizard-cadence" className="text-md font-normal text-primary">
                      Cadence
                    </Label>
                    <div className="relative">
                      <Input id="wizard-cadence" placeholder="Input text" className="pr-8" />
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-primary" />
                    </div>
                  </DialogField>
                </>
              ) : null}
            </DialogBody>
            <DialogWizardFooter
              step={wizardStep}
              steps={wizardSteps}
              onBack={() => setWizardStep((s) => Math.max(1, s - 1))}
              onNext={() => setWizardStep((s) => Math.min(wizardSteps, s + 1))}
              confirmLabel="Create New Member"
            />
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}

const BANNER_VARIANTS = ["default", "warning", "danger", "active"] as const;
const BANNER_SAMPLE = "Viewing Mar 2023 - Feb 2024 (archived) • Read-only";

function CheckboxesSection() {
  const [checked, setChecked] = useState(true);
  const [unchecked, setUnchecked] = useState(false);
  const [withLabel, setWithLabel] = useState(false);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-balance">Checkbox</h1>
        <p className="text-secondary mt-2 text-md text-pretty">
          Figma Design System checkbox — 16px, 4px radius. Unchecked uses border/divider; checked
          uses text/secondary border + check. Use CheckboxIcon inside menus where the row handles
          selection.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">States</h2>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="checkbox-checked"
              checked={checked}
              onCheckedChange={(value) => setChecked(value === true)}
            />
            <Label htmlFor="checkbox-checked" className="text-md font-normal text-primary">
              Checked
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="checkbox-unchecked"
              checked={unchecked}
              onCheckedChange={(value) => setUnchecked(value === true)}
            />
            <Label htmlFor="checkbox-unchecked" className="text-md font-normal text-primary">
              Unchecked
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="checkbox-disabled-off" disabled />
            <Label htmlFor="checkbox-disabled-off" className="text-md font-normal text-primary">
              Disabled
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="checkbox-disabled-on" checked disabled />
            <Label htmlFor="checkbox-disabled-on" className="text-md font-normal text-primary">
              Disabled checked
            </Label>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">With label</h2>
        <div className="flex items-center gap-2">
          <Checkbox
            id="checkbox-labeled"
            checked={withLabel}
            onCheckedChange={(value) => setWithLabel(value === true)}
          />
          <Label htmlFor="checkbox-labeled" className="text-md font-normal text-primary">
            Include commercial drops
          </Label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">CheckboxIcon (decorative)</h2>
        <p className="text-secondary text-sm">
          Non-interactive graphic for list/menu rows — parent owns the hit target.
        </p>
        <div className="flex items-center gap-4">
          <CheckboxIcon checked />
          <CheckboxIcon checked={false} />
        </div>
      </section>
    </div>
  );
}

function BannersSection() {
  const [visible, setVisible] = useState<Record<(typeof BANNER_VARIANTS)[number], boolean>>({
    default: true,
    warning: true,
    danger: true,
    active: true,
  });
  const [pageBannerOpen, setPageBannerOpen] = useState(false);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Banner</h1>
        <p className="text-secondary mt-2 text-md">
          Status banner with four color variants. Default placement is inline in page content; use{" "}
          <code className="text-primary">placement=&quot;page&quot;</code> to pin it over the top of
          the main column.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Inline (default)</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisible({ default: true, warning: true, danger: true, active: true })}
          >
            Reset
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {BANNER_VARIANTS.map((variant) =>
            visible[variant] ? (
              <div key={variant} className="space-y-1">
                <p className="text-secondary text-sm font-medium">{variant}</p>
                <Banner
                  variant={variant}
                  onDismiss={() => setVisible((v) => ({ ...v, [variant]: false }))}
                >
                  {BANNER_SAMPLE}
                </Banner>
              </div>
            ) : null,
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Page (overlay)</h2>
        <p className="text-secondary text-md">
          Renders fixed along the top of the main content area (beside the sidebar).
        </p>
        <Button variant="outline" onClick={() => setPageBannerOpen(true)} disabled={pageBannerOpen}>
          Show page banner
        </Button>
        {pageBannerOpen ? (
          <Banner placement="page" variant="active" onDismiss={() => setPageBannerOpen(false)}>
            {BANNER_SAMPLE}
          </Banner>
        ) : null}
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
    {
      value: "input",
      label: "Input",
      content: <InputsSection />,
    },
    {
      value: "checkbox",
      label: "Checkbox",
      content: <CheckboxesSection />,
    },
    {
      value: "dialog",
      label: "Dialog",
      content: <DialogsSection />,
    },
    {
      value: "banner",
      label: "Banner",
      content: <BannersSection />,
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
