"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogField,
  DialogHeader,
  DialogTitle,
  DialogWizardFooter,
} from "@/components/ui/dialog";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useCreateCaptain, useCreateVolunteer, type MemberRole } from "@/features/members/api";

export interface NewMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (created: { id: string; role: MemberRole; name: string }) => void;
}

const PAY_TYPES = [
  { value: "bundle", label: "Per bundle" },
  { value: "paper", label: "Per paper" },
  { value: "drop", label: "Per drop" },
] as const;

const CADENCES = [
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function SelectField({
  id,
  value,
  onChange,
  children,
  "aria-labelledby": ariaLabelledBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  "aria-labelledby"?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-labelledby={ariaLabelledBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputFieldClassName, "appearance-none pr-8")}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-primary" />
    </div>
  );
}

function NewMemberForm({
  onOpenChange,
  onSuccess,
}: {
  onOpenChange: (open: boolean) => void;
  onSuccess?: NewMemberDialogProps["onSuccess"];
}) {
  const createVolunteer = useCreateVolunteer();
  const createCaptain = useCreateCaptain();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<MemberRole>("volunteer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [payType, setPayType] = useState<"bundle" | "paper" | "drop" | "">("");
  const [payRate, setPayRate] = useState("");
  const [payCadence, setPayCadence] = useState<"biweekly" | "monthly" | "">("");
  const [error, setError] = useState<string | null>(null);

  // Volunteers have no pay config — contact is the last step. Captains need payment step 3.
  const steps = role === "volunteer" ? 2 : 3;

  const titles = [
    "New Member: Basic Details",
    "New Member: Contact Details",
    "New Member: Payment Details",
  ] as const;

  const busy = createVolunteer.isPending || createCaptain.isPending;

  function validateStep(current: number): string | null {
    if (current === 1) {
      if (!firstName.trim() || !lastName.trim()) return "First and last name are required.";
      return null;
    }
    if (current === 2) {
      if (!email.trim()) return "Email address is required.";
      if (!phone.trim()) return "Phone number is required.";
      if (role === "volunteer" && !streetAddress.trim()) return "Street address is required.";
      return null;
    }
    if (current === 3 && role === "captain") {
      if (!payType) return "Pay type is required.";
      if (payRate.trim() === "" || Number.isNaN(Number(payRate)) || Number(payRate) < 0) {
        return "Enter a valid pay rate (0 or greater).";
      }
      if (!payCadence) return "Cadence is required.";
      return null;
    }
    return null;
  }

  function goNext() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((s) => Math.min(steps, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleCreate() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);

    try {
      if (role === "volunteer") {
        const created = await createVolunteer.mutateAsync({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: { addressLines: [streetAddress.trim()] },
          startDate: todayIso(),
        });
        onSuccess?.({
          id: created.id,
          role: "volunteer",
          name: `${created.firstName} ${created.lastName}`,
        });
      } else {
        const created = await createCaptain.mutateAsync({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          payType: payType as "bundle" | "paper" | "drop",
          payRate: Number(payRate),
          payCadence: payCadence as "biweekly" | "monthly",
          startDate: todayIso(),
        });
        onSuccess?.({
          id: created.id,
          role: "captain",
          name: `${created.firstName} ${created.lastName}`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create member.");
    }
  }

  function handleRoleChange(next: MemberRole) {
    setRole(next);
    setError(null);
    // Stay on step 1; if we were somehow past volunteer max steps, clamp.
    setStep((s) => Math.min(s, next === "volunteer" ? 2 : 3));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg">{titles[step - 1]}</DialogTitle>
        <DialogDescription className="sr-only">
          Create a new volunteer or captain in {steps} steps.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        {step === 1 ? (
          <>
            <DialogField>
              <Label
                id="nm-role-label"
                htmlFor="nm-role"
                className="text-md font-normal text-primary"
              >
                Role
              </Label>
              <SelectField
                id="nm-role"
                aria-labelledby="nm-role-label"
                value={role}
                onChange={(v) => handleRoleChange(v as MemberRole)}
              >
                <option value="volunteer">Volunteer</option>
                <option value="captain">Captain</option>
              </SelectField>
            </DialogField>
            <DialogField>
              <Label htmlFor="nm-first" className="text-md font-normal text-primary">
                First Name
              </Label>
              <Input
                id="nm-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Input text"
                autoComplete="given-name"
              />
            </DialogField>
            <DialogField>
              <Label htmlFor="nm-last" className="text-md font-normal text-primary">
                Last Name
              </Label>
              <Input
                id="nm-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Input text"
                autoComplete="family-name"
              />
            </DialogField>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <DialogField>
              <Label htmlFor="nm-email" className="text-md font-normal text-primary">
                Email Address
              </Label>
              <Input
                id="nm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                spellCheck={false}
              />
            </DialogField>
            <DialogField>
              <Label htmlFor="nm-phone" className="text-md font-normal text-primary">
                Phone Number
              </Label>
              <Input
                id="nm-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Input text"
                autoComplete="tel"
              />
            </DialogField>
            {role === "volunteer" ? (
              <DialogField>
                <Label htmlFor="nm-address" className="text-md font-normal text-primary">
                  Street Address
                </Label>
                <Input
                  id="nm-address"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="Input text"
                  autoComplete="street-address"
                />
              </DialogField>
            ) : null}
          </>
        ) : null}

        {step === 3 && role === "captain" ? (
          <>
            <DialogField>
              <Label
                id="nm-pay-type-label"
                htmlFor="nm-pay-type"
                className="text-md font-normal text-primary"
              >
                Pay Type
              </Label>
              <SelectField
                id="nm-pay-type"
                aria-labelledby="nm-pay-type-label"
                value={payType}
                onChange={(v) => setPayType(v as typeof payType)}
              >
                <option value="" disabled>
                  Select pay type
                </option>
                {PAY_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectField>
            </DialogField>
            <DialogField>
              <Label htmlFor="nm-pay-rate" className="text-md font-normal text-primary">
                Pay Rate
              </Label>
              <Input
                id="nm-pay-rate"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                placeholder="0.00"
                className="tabular-nums"
              />
            </DialogField>
            <DialogField>
              <Label
                id="nm-cadence-label"
                htmlFor="nm-cadence"
                className="text-md font-normal text-primary"
              >
                Cadence
              </Label>
              <SelectField
                id="nm-cadence"
                aria-labelledby="nm-cadence-label"
                value={payCadence}
                onChange={(v) => setPayCadence(v as typeof payCadence)}
              >
                <option value="" disabled>
                  Select cadence
                </option>
                {CADENCES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectField>
            </DialogField>
          </>
        ) : null}

        {error ? <p className="text-md text-destructive">{error}</p> : null}
      </DialogBody>
      <DialogWizardFooter
        step={step}
        steps={steps}
        onBack={goBack}
        onNext={goNext}
        onConfirm={() => {
          if (!busy) void handleCreate();
        }}
        confirmLabel={busy ? "Creating…" : "Create New Member"}
      />
    </>
  );
}

function NewMemberDialog({ open, onOpenChange, onSuccess }: NewMemberDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogContent size="lg">
        {open ? (
          <NewMemberForm key="new-member" onOpenChange={onOpenChange} onSuccess={onSuccess} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export { NewMemberDialog };
