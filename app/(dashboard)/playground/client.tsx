"use client";

// TEMPORARY PAGE — all interactive pieces of the API playground.

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { CATALOG, type EndpointSpec, type FieldSpec } from "./catalog";
import { WALKTHROUGHS, type Ctx, type StepRequest, type Walkthrough } from "./walkthroughs";

/* ------------------------------------------------------------------ */
/* Shared plumbing                                                     */
/* ------------------------------------------------------------------ */

interface CallResult {
  status: number;
  ok: boolean;
  elapsedMs: number;
  json: unknown;
}

async function call(req: StepRequest): Promise<CallResult> {
  const started = performance.now();
  const res = await fetch(req.path, {
    method: req.method,
    headers: req.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  const elapsedMs = Math.round(performance.now() - started);
  let json: unknown = null;
  try {
    json = res.status === 204 ? "(204 No Content)" : await res.json();
  } catch {
    json = "(no JSON body)";
  }
  return { status: res.status, ok: res.ok, elapsedMs, json };
}

/** Set a dot-path ("a.b.0.c") on a nested object, creating arrays for numeric segments. */
function setDeep(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let node: Record<string, unknown> | unknown[] = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    const idx = /^\d+$/.test(key) ? Number(key) : key;
    const container = node as Record<string | number, unknown>;
    if (container[idx] === undefined) container[idx] = nextIsIndex ? [] : {};
    node = container[idx] as Record<string, unknown> | unknown[];
  }
  const last = parts[parts.length - 1];
  (node as Record<string | number, unknown>)[/^\d+$/.test(last) ? Number(last) : last] = value;
}

function buildRequest(spec: EndpointSpec, values: Record<string, string | boolean>): StepRequest {
  let path = spec.path;
  const query = new URLSearchParams();
  const body: Record<string, unknown> = {};
  let hasBody = false;

  for (const field of spec.fields) {
    const raw = values[field.path];
    const where = field.in ?? "body";
    if (field.kind === "boolean") {
      if (raw === true && where === "query") query.set(field.path, "true");
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") continue;

    if (where === "path") {
      path = path.replace(`{${field.path}}`, encodeURIComponent(text));
    } else if (where === "query") {
      query.set(field.path, text);
    } else {
      hasBody = true;
      if (field.kind === "number") setDeep(body, field.path, Number(text));
      else if (field.kind === "bundles") {
        const bundles = text
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n))
          .map((papers) => ({ papers }));
        setDeep(body, field.path, bundles);
      } else setDeep(body, field.path, text);
    }
  }
  const qs = query.toString();
  return {
    method: spec.method,
    path: qs ? `${path}?${qs}` : path,
    body: hasBody ? body : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Ref dropdowns (live options from the list endpoints)                */
/* ------------------------------------------------------------------ */

type RefName = NonNullable<FieldSpec["ref"]>;
interface Option {
  value: string;
  label: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const REF_LABELS: Record<RefName, (row: any) => string> = {
  volunteers: (r) => `${r.firstName} ${r.lastName} (${r.status})`,
  captains: (r) => `${r.firstName} ${r.lastName} — ${r.payType} $${r.payRate} (${r.status})`,
  territories: (r) => (r.captain ? `${r.captain.name}'s territory` : "Territory (no captain)"),
  routes: (r) => `${r.streetName} (${r.lifecycle}${r.suspended ? ", suspended" : ""})`,
  "financial-years": (r) => r.name,
};

const refCache = new Map<RefName, Option[]>();
const refListeners = new Set<() => void>();

export function bustRefCache(): void {
  refCache.clear();
  refListeners.forEach((fn) => fn());
}

async function loadRef(ref: RefName): Promise<Option[]> {
  const cached = refCache.get(ref);
  if (cached) return cached;
  const res = await fetch(`/api/${ref}`);
  const json = await res.json();
  const options: Option[] = ((json?.data as any[]) ?? []).map((row) => ({
    value: row.id,
    label: REF_LABELS[ref](row),
  }));
  refCache.set(ref, options);
  return options;
}

function useRefOptions(ref: RefName): { options: Option[]; reload: () => void } {
  const [options, setOptions] = useState<Option[]>([]);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    loadRef(ref).then((opts) => live && setOptions(opts));
    const listener = () => setNonce((n) => n + 1);
    refListeners.add(listener);
    return () => {
      live = false;
      refListeners.delete(listener);
    };
  }, [ref, nonce]);
  return {
    options,
    reload: () => {
      refCache.delete(ref);
      setNonce((n) => n + 1);
    },
  };
}

function RefSelect(props: { field: FieldSpec; value: string; onChange: (v: string) => void }) {
  const { options, reload } = useRefOptions(props.field.ref!);
  return (
    <div className="flex gap-1">
      <select
        className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button type="button" variant="ghost" size="sm" onClick={reload} title="Refresh options">
        ↻
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Response panel                                                      */
/* ------------------------------------------------------------------ */

function StatusChip({ result, expected }: { result: CallResult; expected?: number }) {
  const wasExpected = expected !== undefined && result.status === expected;
  const tone = result.ok
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    : wasExpected || result.status < 500
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return (
    <span className={cn("rounded px-2 py-0.5 font-mono text-xs font-semibold", tone)}>
      {result.status}
      {wasExpected ? " (expected!)" : ""} · {result.elapsedMs}ms
    </span>
  );
}

function ResponsePanel({ result, expected }: { result: CallResult; expected?: number }) {
  return (
    <div className="mt-2 space-y-1">
      <StatusChip result={result} expected={expected} />
      <pre className="bg-muted max-h-72 overflow-auto rounded-md p-2 font-mono text-xs">
        {typeof result.json === "string" ? result.json : JSON.stringify(result.json, null, 2)}
      </pre>
    </div>
  );
}

const METHOD_TONE: Record<string, string> = {
  GET: "text-sky-700 dark:text-sky-400",
  POST: "text-emerald-700 dark:text-emerald-400",
  PATCH: "text-amber-700 dark:text-amber-400",
  DELETE: "text-red-700 dark:text-red-400",
};

/* ------------------------------------------------------------------ */
/* Endpoint card                                                       */
/* ------------------------------------------------------------------ */

function EndpointCard({ spec }: { spec: EndpointSpec }) {
  const initial = useMemo(() => {
    const v: Record<string, string | boolean> = {};
    for (const f of spec.fields) {
      v[f.path] = f.kind === "boolean" ? false : f.example !== undefined ? String(f.example) : "";
    }
    return v;
  }, [spec]);
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState<CallResult | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = buildRequest(spec, values);

  const send = useCallback(async () => {
    setBusy(true);
    try {
      const res = await call(buildRequest(spec, values));
      setResult(res);
      if (res.ok && spec.method !== "GET") bustRefCache();
    } finally {
      setBusy(false);
    }
  }, [spec, values]);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={cn("font-mono text-xs font-bold", METHOD_TONE[spec.method])}>
          {spec.method}
        </span>
        <span className="font-mono text-xs">{spec.path}</span>
        <span className="text-sm font-semibold">{spec.title}</span>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">{spec.description}</p>
      {spec.rules && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Rules: {spec.rules}</p>
      )}

      <details className="mt-2">
        <summary className="text-muted-foreground cursor-pointer text-xs">Shapes</summary>
        {spec.requestShape && (
          <pre className="bg-muted mt-1 overflow-auto rounded p-2 font-mono text-xs">
            request: {spec.requestShape}
          </pre>
        )}
        <pre className="bg-muted mt-1 overflow-auto rounded p-2 font-mono text-xs">
          response: {spec.responseShape}
        </pre>
      </details>

      {spec.fields.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {spec.fields.map((f) => (
            <div key={f.path} className={cn(f.kind === "boolean" && "flex items-center gap-2")}>
              {f.kind !== "boolean" && (
                <Label className="text-xs">
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
              )}
              {f.kind === "ref" ? (
                <RefSelect
                  field={f}
                  value={String(values[f.path] ?? "")}
                  onChange={(v) => setValues((s) => ({ ...s, [f.path]: v }))}
                />
              ) : f.kind === "select" ? (
                <select
                  className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
                  value={String(values[f.path] ?? "")}
                  onChange={(e) => setValues((s) => ({ ...s, [f.path]: e.target.value }))}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o === "" ? "— any —" : o}
                    </option>
                  ))}
                </select>
              ) : f.kind === "boolean" ? (
                <>
                  <input
                    type="checkbox"
                    checked={values[f.path] === true}
                    onChange={(e) => setValues((s) => ({ ...s, [f.path]: e.target.checked }))}
                  />
                  <Label className="text-xs">{f.label}</Label>
                </>
              ) : (
                <Input
                  className="h-8 text-sm"
                  type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                  placeholder={f.placeholder}
                  value={String(values[f.path] ?? "")}
                  onChange={(e) => setValues((s) => ({ ...s, [f.path]: e.target.value }))}
                />
              )}
              {f.help && <p className="text-muted-foreground mt-0.5 text-xs">{f.help}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={send} disabled={busy}>
          {busy ? "Sending…" : "Send"}
        </Button>
        <code className="text-muted-foreground font-mono text-xs">
          {preview.method} {preview.path}
          {preview.body ? ` ${JSON.stringify(preview.body)}` : ""}
        </code>
      </div>
      {result && <ResponsePanel result={result} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Explorer (all sections)                                             */
/* ------------------------------------------------------------------ */

export function Explorer() {
  return (
    <div className="space-y-4">
      {CATALOG.map((section) => (
        <details key={section.id} className="rounded-lg border">
          <summary className="cursor-pointer p-4">
            <span className="text-lg font-semibold">{section.title}</span>
            <span className="text-muted-foreground ml-2 text-sm">
              {section.endpoints.length} endpoints
            </span>
            <p className="text-muted-foreground mt-1 text-sm font-normal">{section.blurb}</p>
          </summary>
          <div className="space-y-3 p-4 pt-0">
            {section.endpoints.map((e) => (
              <EndpointCard key={e.id} spec={e} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Walkthrough runner                                                  */
/* ------------------------------------------------------------------ */

interface StepOutcome {
  request: StepRequest;
  result: CallResult;
  passed: boolean;
}

function WalkthroughStrip({ walkthrough }: { walkthrough: Walkthrough }) {
  const [ctx, setCtx] = useState<Ctx>({});
  const [outcomes, setOutcomes] = useState<StepOutcome[]>([]);
  const [busy, setBusy] = useState(false);
  const current = outcomes.length;

  const runNext = useCallback(async () => {
    const step = walkthrough.steps[current];
    if (!step) return;
    setBusy(true);
    try {
      const nextCtx = { ...ctx };
      const request = step.build(nextCtx);
      const result = await call(request);
      const passed = step.expectStatus ? result.status === step.expectStatus : result.ok;
      if (result.ok && step.extract)
        step.extract((result.json as { data?: unknown })?.data, nextCtx);
      if (result.ok && request.method !== "GET") bustRefCache();
      setCtx(nextCtx);
      setOutcomes((o) => [...o, { request, result, passed }]);
    } finally {
      setBusy(false);
    }
  }, [walkthrough, current, ctx]);

  const restart = () => {
    setCtx({});
    setOutcomes([]);
  };

  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer p-4">
        <span className="text-lg font-semibold">{walkthrough.title}</span>
        <p className="text-muted-foreground mt-1 text-sm font-normal">{walkthrough.intro}</p>
      </summary>
      <div className="space-y-3 p-4 pt-0">
        {walkthrough.steps.map((step, i) => {
          const outcome = outcomes[i];
          const isCurrent = i === current;
          return (
            <div
              key={i}
              className={cn(
                "rounded-md border p-3",
                isCurrent && "border-foreground/40",
                outcome && !outcome.passed && "border-red-400",
                i > current && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{i + 1}.</span>
                <span className="text-sm font-medium">{step.title}</span>
                {outcome && (
                  <span className="text-xs">
                    {outcome.passed ? "✓" : "✗ (unexpected — see below)"}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{step.note}</p>
              {isCurrent && (
                <Button size="sm" className="mt-2" onClick={runNext} disabled={busy}>
                  {busy ? "Running…" : "Run this step"}
                </Button>
              )}
              {outcome && (
                <div className="mt-2">
                  <code className="text-muted-foreground block font-mono text-xs">
                    {outcome.request.method} {outcome.request.path}
                    {outcome.request.body ? ` ${JSON.stringify(outcome.request.body)}` : ""}
                  </code>
                  <ResponsePanel result={outcome.result} expected={step.expectStatus} />
                  {outcome.passed && step.after && (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                      {step.after}
                    </p>
                  )}
                  {!outcome.passed && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Unexpected result — earlier playground runs may have changed the data. “Reset
                      sandbox data” (top of page) restores the pristine dataset; then Restart below.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {outcomes.length > 0 && (
          <Button variant="outline" size="sm" onClick={restart}>
            Restart walkthrough
          </Button>
        )}
      </div>
    </details>
  );
}

export function Walkthroughs() {
  return (
    <div className="space-y-4">
      {WALKTHROUGHS.map((w) => (
        <WalkthroughStrip key={w.id} walkthrough={w} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reset sandbox                                                       */
/* ------------------------------------------------------------------ */

export function ResetSandboxButton() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const reset = async () => {
    if (
      !window.confirm(
        "Reset ALL sandbox data? Every table is wiped and the pristine seed dataset is restored. Anything anyone created in the playground is deleted.",
      )
    ) {
      return;
    }
    setState("busy");
    const res = await call({ method: "POST", path: "/api/playground/reset" });
    if (res.ok) {
      setState("done");
      setMessage("Sandbox restored to the seed dataset.");
      bustRefCache();
    } else {
      setState("error");
      setMessage(
        `Reset failed (${res.status}): ${JSON.stringify((res.json as { error?: { message?: string } })?.error?.message ?? res.json)}`,
      );
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={reset} disabled={state === "busy"}>
        {state === "busy" ? "Resetting…" : "Reset sandbox data"}
      </Button>
      {message && (
        <span
          className={cn(
            "text-xs",
            state === "done" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600",
          )}
        >
          {message}
        </span>
      )}
    </div>
  );
}
