// Shared CBA engine — one place for the 2023 CBA's salary-matching bands,
// apron restrictions, and cap classification. The Trade Machine and Roster
// Builder both consume this, and every violation cites the actual rule.
//
// Encoded from the 2023 CBA's trade-matching structure:
//   Below the first apron (expanded TPE):
//     outgoing ≤ $7.5M           → may take back 200% of outgoing + $250k
//     $7.5M < outgoing ≤ $29M    → outgoing + $7.5M
//     outgoing > $29M            → 125% of outgoing + $250k
//   At/above the first apron     → 110% of outgoing (hard-capped at the apron)
//   At/above the second apron    → 100% of outgoing, salaries may NOT be
//                                  aggregated (one outgoing contract per deal)
import { SALARY_CAP, LUXURY_TAX, FIRST_APRON, SECOND_APRON } from "@/lib/data";

export { SALARY_CAP, LUXURY_TAX, FIRST_APRON, SECOND_APRON };

export type CapBand = "Under Cap" | "Over Cap" | "Luxury Tax" | "1st Apron" | "2nd Apron";

export function capBand(payroll: number): CapBand {
  if (payroll > SECOND_APRON) return "2nd Apron";
  if (payroll > FIRST_APRON) return "1st Apron";
  if (payroll > LUXURY_TAX) return "Luxury Tax";
  if (payroll > SALARY_CAP) return "Over Cap";
  return "Under Cap";
}

export interface MatchRule {
  allowed: number; // max incoming salary, $M
  rule: string; // the CBA rule this came from, cited in failure reasons
}

/** Max salary a team may take back for `out` $M outgoing at a given payroll. */
export function matchAllowance(out: number, payroll: number): MatchRule {
  if (payroll > SECOND_APRON)
    return {
      allowed: out,
      rule: "2nd-apron teams may not take back more salary than they send (100% matching).",
    };
  if (payroll > FIRST_APRON)
    return {
      allowed: out * 1.1,
      rule: "1st-apron teams are limited to 110% of outgoing salary.",
    };
  if (out <= 7.5)
    return {
      allowed: out * 2 + 0.25,
      rule: "Below the apron, outgoing salary up to $7.5M may return 200% + $250k.",
    };
  if (out <= 29)
    return {
      allowed: out + 7.5,
      rule: "Below the apron, outgoing salary of $7.5–29M may return outgoing + $7.5M.",
    };
  return {
    allowed: out * 1.25 + 0.25,
    rule: "Below the apron, outgoing salary above $29M may return 125% + $250k.",
  };
}

export interface CbaCheck {
  legal: boolean;
  reasons: string[]; // each cites the rule it comes from
  allowed: number;
  band: CapBand;
  newBand: CapBand;
}

/** Full trade-side legality check with rule-citing reasons. */
export function checkTradeSide(args: {
  abbr: string;
  payroll: number; // pre-trade
  outgoing: number; // total $M out
  incoming: number; // total $M in
  outgoingCount: number; // number of contracts sent
}): CbaCheck {
  const { abbr, payroll, outgoing, incoming, outgoingCount } = args;
  const reasons: string[] = [];
  const band = capBand(payroll);
  const newPayroll = payroll - outgoing + incoming;
  const newBand = capBand(newPayroll);
  const { allowed, rule } = matchAllowance(outgoing, payroll);

  // Cap-room absorption: a team that stays under the cap after the trade
  // doesn't need salary matching at all.
  const fitsInRoom = newPayroll <= SALARY_CAP;
  if (!fitsInRoom && incoming > allowed) {
    reasons.push(
      `${abbr} takes in $${incoming.toFixed(1)}M for $${outgoing.toFixed(1)}M out — limit is $${allowed.toFixed(1)}M. ${rule}`,
    );
  }
  if (payroll > SECOND_APRON && outgoingCount > 1) {
    reasons.push(
      `${abbr} aggregates ${outgoingCount} contracts — 2nd-apron teams may not aggregate salaries in a trade.`,
    );
  }
  if (newPayroll > SECOND_APRON && incoming > outgoing) {
    reasons.push(
      `${abbr} finishes above the 2nd apron while adding salary — the apron acts as a hard cap here.`,
    );
  }
  return { legal: reasons.length === 0, reasons, allowed, band, newBand };
}

// Roster construction context (Roster Builder): where a payroll sits and what
// that position costs in flexibility, stated as the rules say it.
export interface CapSituation {
  band: CapBand;
  room: number; // vs the cap (negative = over)
  notes: string[];
}

export function capSituation(payroll: number): CapSituation {
  const band = capBand(payroll);
  const notes: string[] = [];
  if (band === "Under Cap")
    notes.push(`$${(SALARY_CAP - payroll).toFixed(1)}M in cap room — can absorb salary without matching.`);
  if (band === "Over Cap")
    notes.push("Over the cap but under the tax — full mid-level exception available.");
  if (band === "Luxury Tax")
    notes.push(`$${(payroll - LUXURY_TAX).toFixed(1)}M into the tax — repeater penalties scale fast.`);
  if (band === "1st Apron")
    notes.push(
      "Above the 1st apron: no sign-and-trade acquisitions, no buyout-market signings above the MLE, trade matching tightens to 110%.",
    );
  if (band === "2nd Apron")
    notes.push(
      "Above the 2nd apron: no salary aggregation in trades, no cash in trades, taxpayer MLE unavailable, and the team's future first gets frozen at the end of round one.",
    );
  return { band, room: SALARY_CAP - payroll, notes };
}
