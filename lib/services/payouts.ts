// Captain payouts: the per-cell actions (finance flow §4c–4g).
// Editability rule (locked): a cell can change while UNPAID (open or closed);
// marking paid locks it. Transfer = paired overrides (locked decision).
import type { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import type { overridePayout, transferPayout } from "@/lib/validation/finance";
import type { CaptainPayoutRow, CaptainRow, RouteDeliveryRow, VolunteerRouteRow } from "@/types/db";

import { billableQuantity, calculationStatus, effectiveAmount } from "./derive";
import { fetchIssue } from "./issues";
import { coerceCaptainNumerics, coercePayoutNumerics, db, throwDb, today } from "./shared";

export interface PayoutSummary {
  id: string;
  issueId: string;
  captainId: string;
  captainName: string;
  calculatedAmount: number;
  overrideAmount: number | null;
  overrideReason: string | null;
  effectiveAmount: number;
  calculationStatus: "calculated" | "frozen" | "overridden";
  /** Locked against recalculation on bundling day. Independent of `paid`. */
  frozenAmount: number | null;
  frozenAt: string | null;
  /** Set when another captain covered this issue; the payment is theirs. */
  substituteCaptainId: string | null;
  substituteCaptainName: string | null;
  paid: boolean;
  paidAt: string | null;
}

export interface PayoutDetail extends PayoutSummary {
  breakdown: {
    payType: string;
    payRate: number;
    perRoute: Array<{
      routeId: string;
      streetName: string;
      unitCount: number;
      missedCount: number;
      billable: number;
    }>;
    totalQuantity: number;
  };
}

async function captainName(client: ReturnType<typeof db>, id: string): Promise<string> {
  const { data } = await client
    .from("captains")
    .select("first_name, last_name")
    .eq("id", id)
    .maybeSingle();
  const c = data as Pick<CaptainRow, "first_name" | "last_name"> | null;
  return c ? `${c.first_name} ${c.last_name}` : "Unknown captain";
}

function toSummary(
  p: CaptainPayoutRow,
  name: string,
  substituteName?: string | null,
): PayoutSummary {
  return {
    id: p.id,
    issueId: p.issue_id,
    captainId: p.captain_id,
    captainName: name,
    calculatedAmount: p.calculated_amount,
    overrideAmount: p.override_amount,
    overrideReason: p.override_reason,
    effectiveAmount: effectiveAmount(p),
    calculationStatus: calculationStatus(p),
    frozenAmount: p.frozen_amount,
    frozenAt: p.frozen_at,
    substituteCaptainId: p.substitute_captain_id,
    substituteCaptainName: substituteName ?? null,
    paid: p.paid,
    paidAt: p.paid_at,
  };
}

async function fetchPayout(id: string): Promise<CaptainPayoutRow> {
  const { data, error } = await db().from("captain_payouts").select("*").eq("id", id).maybeSingle();
  if (error) throwDb(error);
  if (!data) throw notFound("Payout");
  return coercePayoutNumerics(data as CaptainPayoutRow);
}

export async function listPayouts(issueId: string): Promise<PayoutSummary[]> {
  await fetchIssue(issueId);
  const client = db();
  const [pRes, cRes] = await Promise.all([
    client.from("captain_payouts").select("*").eq("issue_id", issueId),
    client.from("captains").select("id, first_name, last_name"),
  ]);
  if (pRes.error) throwDb(pRes.error);
  if (cRes.error) throwDb(cRes.error);
  const captains = (cRes.data ?? []) as Pick<CaptainRow, "id" | "first_name" | "last_name">[];
  const nameOf = (id: string | null) => {
    const c = id ? captains.find((x) => x.id === id) : undefined;
    return c ? `${c.first_name} ${c.last_name}` : null;
  };
  return ((pRes.data ?? []) as CaptainPayoutRow[]).map((raw) => {
    const p = coercePayoutNumerics(raw);
    return toSummary(p, nameOf(p.captain_id) ?? "Unknown captain", nameOf(p.substitute_captain_id));
  });
}

/** Paid cell attributed to this captain as payee (own territory or substitute coverage). */
export interface CaptainReimbursement {
  id: string;
  amount: number;
  paidAt: string;
  issue: { id: string; name: string; date: string };
  kind: "own" | "substitute";
  coveredForName: string | null;
}

export interface CaptainReimbursementsResult {
  items: CaptainReimbursement[];
  hasMore: boolean;
}

type PayoutWithIssue = CaptainPayoutRow & {
  issues: { id: string; name: string; date: string };
};

/**
 * Recent confirmed reimbursements for a captain: paid payout cells where they
 * are the payee (own cell with no substitute, or substitute on someone else's).
 * Fetches limit+1 to report hasMore without a separate count query.
 */
export async function listRecentPaidPayoutsForCaptain(
  captainId: string,
  limit = 4,
): Promise<CaptainReimbursementsResult> {
  const client = db();
  const { data: captainData, error: captainError } = await client
    .from("captains")
    .select("id")
    .eq("id", captainId)
    .maybeSingle();
  if (captainError) throwDb(captainError);
  if (!captainData) throw notFound("Captain");

  const { data, error } = await client
    .from("captain_payouts")
    .select("*, issues!inner(id, name, date)")
    .eq("paid", true)
    .or(
      `and(captain_id.eq.${captainId},substitute_captain_id.is.null),substitute_captain_id.eq.${captainId}`,
    )
    .order("paid_at", { ascending: false })
    .limit(limit + 1);
  if (error) throwDb(error);

  const rows = (data ?? []) as PayoutWithIssue[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  const coveredIds = [
    ...new Set(page.filter((r) => r.substitute_captain_id === captainId).map((r) => r.captain_id)),
  ];
  const nameById = new Map<string, string>();
  if (coveredIds.length > 0) {
    const { data: nameData, error: nameError } = await client
      .from("captains")
      .select("id, first_name, last_name")
      .in("id", coveredIds);
    if (nameError) throwDb(nameError);
    for (const c of (nameData ?? []) as Pick<CaptainRow, "id" | "first_name" | "last_name">[]) {
      nameById.set(c.id, `${c.first_name} ${c.last_name}`);
    }
  }

  const items: CaptainReimbursement[] = page.map((raw) => {
    const p = coercePayoutNumerics(raw);
    const isSubstitute = p.substitute_captain_id === captainId;
    return {
      id: p.id,
      amount: effectiveAmount(p),
      paidAt: p.paid_at!,
      issue: {
        id: raw.issues.id,
        name: raw.issues.name,
        date: raw.issues.date,
      },
      kind: isSubstitute ? "substitute" : "own",
      coveredForName: isSubstitute ? (nameById.get(p.captain_id) ?? "Unknown captain") : null,
    };
  });

  return { items, hasMore };
}

/** Detail + the calculation breakdown (quantity × rate; finance flow §4c). */
export async function getPayout(id: string): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  const client = db();

  const { data: captainData, error: captainError } = await client
    .from("captains")
    .select("*")
    .eq("id", p.captain_id)
    .maybeSingle();
  if (captainError) throwDb(captainError);
  const captain = captainData ? coerceCaptainNumerics(captainData as CaptainRow) : null;
  if (!captain) throw notFound("Captain");

  // Current rollup chain for this captain's territory.
  const [territoryRes, deliveriesRes] = await Promise.all([
    client
      .from("captain_territories")
      .select("id")
      .eq("assigned_captain_id", captain.id)
      .maybeSingle(),
    client.from("route_deliveries").select("*").eq("issue_id", p.issue_id),
  ]);
  if (territoryRes.error) throwDb(territoryRes.error);
  if (deliveriesRes.error) throwDb(deliveriesRes.error);

  const perRoute: PayoutDetail["breakdown"]["perRoute"] = [];
  if (territoryRes.data) {
    const territoryId = (territoryRes.data as { id: string }).id;
    const { data: volunteerData, error: volunteerError } = await client
      .from("volunteers")
      .select("id")
      .eq("captain_territory_id", territoryId);
    if (volunteerError) throwDb(volunteerError);
    const volunteerIds = ((volunteerData ?? []) as Array<{ id: string }>).map((v) => v.id);

    const { data: routeData, error: routeError } =
      volunteerIds.length > 0
        ? await client
            .from("volunteer_routes")
            .select("id, street_name")
            .in("assigned_volunteer_id", volunteerIds)
        : { data: [], error: null };
    if (routeError) throwDb(routeError);
    const routes = (routeData ?? []) as Pick<VolunteerRouteRow, "id" | "street_name">[];
    const routeIds = new Set(routes.map((r) => r.id));

    for (const d of (deliveriesRes.data ?? []) as RouteDeliveryRow[]) {
      if (!routeIds.has(d.route_id)) continue;
      const counts = {
        paperCount: d.paper_count,
        bundles: d.bundles,
        dropCount: d.drop_count,
        missedCount: d.missed_count,
      };
      const unitCount =
        captain.pay_type === "bundle"
          ? d.bundles.length
          : captain.pay_type === "paper"
            ? d.paper_count
            : d.drop_count;
      perRoute.push({
        routeId: d.route_id,
        streetName: routes.find((r) => r.id === d.route_id)?.street_name ?? "",
        unitCount,
        missedCount: d.missed_count,
        billable: billableQuantity(captain.pay_type, counts),
      });
    }
  }

  const substituteName = p.substitute_captain_id
    ? await captainName(client, p.substitute_captain_id)
    : null;

  return {
    ...toSummary(p, `${captain.first_name} ${captain.last_name}`, substituteName),
    breakdown: {
      payType: captain.pay_type,
      payRate: captain.pay_rate,
      perRoute,
      totalQuantity: perRoute.reduce((s, r) => s + r.billable, 0),
    },
  };
}

function assertUnpaid(p: CaptainPayoutRow): void {
  if (p.paid) throw conflict("This payout is marked paid — unmark it before editing.");
}

export async function overridePayoutAmount(
  id: string,
  input: z.infer<typeof overridePayout>,
): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  assertUnpaid(p);
  const { error } = await db()
    .from("captain_payouts")
    .update({ override_amount: input.amount, override_reason: input.reason })
    .eq("id", id);
  if (error) throwDb(error);
  return getPayout(id);
}

export async function clearPayoutOverride(id: string): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  assertUnpaid(p);
  if (p.override_amount === null) throw conflict("This payout is not overridden.");
  const { error } = await db()
    .from("captain_payouts")
    .update({ override_amount: null, override_reason: null })
    .eq("id", id);
  if (error) throwDb(error);
  return getPayout(id);
}

/** Only toggleable once the issue is Closed; marking paid locks the cell. */
export async function markPayoutPaid(id: string): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  const issue = await fetchIssue(p.issue_id);
  if (issue.status !== "closed") {
    throw conflict("Payouts can only be marked paid once the issue is closed.");
  }
  if (p.paid) throw conflict("Payout is already marked paid.");
  const { error } = await db()
    .from("captain_payouts")
    .update({ paid: true, paid_at: today() })
    .eq("id", id);
  if (error) throwDb(error);
  return getPayout(id);
}

export async function unmarkPayoutPaid(id: string): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  if (!p.paid) throw conflict("Payout is not marked paid.");
  const { error } = await db()
    .from("captain_payouts")
    .update({ paid: false, paid_at: null })
    .eq("id", id);
  if (error) throwDb(error);
  return getPayout(id);
}

/**
 * Freeze: snapshot the live calculation so later route or carrier edits can't
 * move this cell. Distinct from paid — the office locks amounts on bundling day
 * and pays later, and an issue does not need to be closed to freeze.
 */
export async function freezePayout(id: string): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  assertUnpaid(p);
  if (p.frozen_amount !== null) throw conflict("Payout is already frozen.");
  const { error } = await db()
    .from("captain_payouts")
    .update({ frozen_amount: p.calculated_amount, frozen_at: today() })
    .eq("id", id);
  if (error) throwDb(error);
  return getPayout(id);
}

/** Unfreeze: drop the snapshot and track the live calculation again. */
export async function unfreezePayout(id: string): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  assertUnpaid(p);
  if (p.frozen_amount === null) throw conflict("Payout is not frozen.");
  const { error } = await db()
    .from("captain_payouts")
    .update({ frozen_amount: null, frozen_at: null })
    .eq("id", id);
  if (error) throwDb(error);
  return getPayout(id);
}

/**
 * Record that another captain covered this issue. The cell stays on the original
 * captain so the (issue, captain) grid is unchanged; the payment is attributed
 * to the substitute, which is what lets substitute pay be totalled separately.
 *
 * Supersedes the transfer-as-substitute workaround: transfer moved money between
 * cells and left only free text behind, so it could not be aggregated.
 */
export async function setPayoutSubstitute(
  id: string,
  substituteCaptainId: string,
): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  assertUnpaid(p);
  if (substituteCaptainId === p.captain_id) {
    throw conflict("A captain cannot substitute for themselves.");
  }
  const { data, error: lookupError } = await db()
    .from("captains")
    .select("id, retired_at")
    .eq("id", substituteCaptainId)
    .maybeSingle();
  if (lookupError) throwDb(lookupError);
  if (!data) throw notFound("Captain");
  if ((data as CaptainRow).retired_at) {
    throw conflict("Cannot assign a retired captain as a substitute.");
  }

  const { error } = await db()
    .from("captain_payouts")
    .update({ substitute_captain_id: substituteCaptainId })
    .eq("id", id);
  if (error) throwDb(error);
  return getPayout(id);
}

/** Clear the substitute; the payment reverts to the cell's own captain. */
export async function clearPayoutSubstitute(id: string): Promise<PayoutDetail> {
  const p = await fetchPayout(id);
  assertUnpaid(p);
  if (p.substitute_captain_id === null) throw conflict("Payout has no substitute.");
  const { error } = await db()
    .from("captain_payouts")
    .update({ substitute_captain_id: null })
    .eq("id", id);
  if (error) throwDb(error);
  return getPayout(id);
}

/**
 * Transfer (finance flow §4g), implemented as PAIRED OVERRIDES (locked decision):
 * the recipient's cell is overridden up by this cell's effective amount and this
 * cell is overridden to 0. Both carry auto-generated reasons. Undo by clearing
 * the overrides. The recipient must already have a cell in this issue.
 */
export async function transferPayoutAmount(
  id: string,
  input: z.infer<typeof transferPayout>,
): Promise<PayoutDetail> {
  const source = await fetchPayout(id);
  assertUnpaid(source);
  if (input.toCaptainId === source.captain_id) {
    throw conflict("Cannot transfer a payout to its own captain.");
  }

  const amount = effectiveAmount(source);
  if (amount <= 0) throw conflict("Nothing to transfer — the effective amount is 0.");

  const client = db();
  const { data: recipientData, error: recipientError } = await client
    .from("captain_payouts")
    .select("*")
    .eq("issue_id", source.issue_id)
    .eq("captain_id", input.toCaptainId)
    .maybeSingle();
  if (recipientError) throwDb(recipientError);
  const recipient = recipientData ? coercePayoutNumerics(recipientData as CaptainPayoutRow) : null;
  if (!recipient) {
    throw conflict("The receiving captain has no payout cell in this issue.");
  }
  if (recipient.paid) {
    throw conflict("The receiving payout is marked paid — unmark it first.");
  }

  const [sourceName, recipientName] = await Promise.all([
    captainName(client, source.captain_id),
    captainName(client, input.toCaptainId),
  ]);

  // Ordered source-first so a partial failure underpays rather than double-pays.
  const { error: sourceUpdateError } = await client
    .from("captain_payouts")
    .update({ override_amount: 0, override_reason: `Transferred to ${recipientName}` })
    .eq("id", source.id);
  if (sourceUpdateError) throwDb(sourceUpdateError);

  const { error: recipientUpdateError } = await client
    .from("captain_payouts")
    .update({
      override_amount: Math.round((effectiveAmount(recipient) + amount) * 100) / 100,
      override_reason: `Includes $${amount.toFixed(2)} transferred from ${sourceName}`,
    })
    .eq("id", recipient.id);
  if (recipientUpdateError) throwDb(recipientUpdateError);

  return getPayout(id);
}
