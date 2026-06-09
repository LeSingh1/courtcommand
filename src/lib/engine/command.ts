import { TOOLS } from "@/lib/tools";
import { PLAYERS } from "@/lib/data";
import type { ToolMeta } from "@/lib/types";

export interface CommandMatch {
  tool: ToolMeta;
  confidence: number;
  reason: string;
  href: string;
  params: Record<string, string>;
}

const INTENTS: { slug: string; patterns: RegExp[] }[] = [
  { slug: "underrated", patterns: [/underrated/i, /overlooked/i, /sleeper/i, /hidden gem/i, /value under \$?\d/i] },
  { slug: "player-similarity", patterns: [/similar/i, /compare .* to/i, /like (a )?young/i, /\bcomp(s)?\b/i, /twin/i] },
  { slug: "trade-machine", patterns: [/\btrade\b/i, /\bdeal\b/i, /salary match/i, /send .* for/i] },
  { slug: "fantasy-draft", patterns: [/fantasy/i, /\bdraft\b/i, /punt/i, /who should i pick/i] },
  { slug: "clutch", patterns: [/clutch/i, /late game/i, /fourth quarter/i, /closer/i] },
  { slug: "march-madness", patterns: [/march madness/i, /bracket/i, /ncaa/i, /tournament/i] },
  { slug: "ref-bias", patterns: [/ref/i, /foul/i, /whistle/i, /officiating/i] },
  { slug: "lineup-optimizer", patterns: [/lineup/i, /best (5|five)/i, /starting five/i, /optimi[sz]e/i] },
  { slug: "injury-risk", patterns: [/injur/i, /\brisk\b/i, /load manage/i, /durab/i, /health/i] },
  { slug: "win-probability", patterns: [/win prob/i, /comeback/i, /\bodds\b/i, /chance to win/i] },
  { slug: "highlight-clipper", patterns: [/highlight/i, /\bclip/i, /reel/i] },
  { slug: "recruit-rank", patterns: [/recruit/i, /high school/i, /prospect/i, /\bstars?\b rating/i] },
  { slug: "contract-value", patterns: [/overpaid/i, /underpaid/i, /contract/i, /salary value/i, /bargain/i] },
  { slug: "playtype", patterns: [/play ?type/i, /pick and roll mix/i, /possession type/i, /\biso\b/i] },
  { slug: "team-chemistry", patterns: [/chemistry/i, /\bfit\b/i, /fit on/i, /pair/i] },
  { slug: "momentum", patterns: [/momentum/i, /\brun\b/i, /swing/i] },
  { slug: "development-curve", patterns: [/develop/i, /growth/i, /projection/i, /ceiling/i, /how good will/i] },
  { slug: "shot-chart", patterns: [/shot chart/i, /hot zone/i, /heat ?map/i, /where .* shoot/i] },
  { slug: "debate", patterns: [/\bvs\.?\b/i, /better than/i, /\bdebate\b/i, /\bgoat\b/i, /who is better/i] },
  { slug: "role-classifier", patterns: [/\brole\b/i, /archetype/i, /3 ?and ?d/i, /what kind of player/i] },
  { slug: "training-tracker", patterns: [/training/i, /workout/i, /\breps\b/i, /habit/i] },
  { slug: "scouting-report", patterns: [/scout/i, /strengths and weakness/i, /report on/i] },
  { slug: "game-recap", patterns: [/recap/i, /box score/i, /write.?up/i, /game story/i] },
  { slug: "pick-and-roll", patterns: [/pick.and.roll/i, /\bpnr\b/i, /roll man/i, /two.man game/i] },
  { slug: "news-sentiment", patterns: [/sentiment/i, /media/i, /narrative/i, /headlines/i] },
  { slug: "award-predictor", patterns: [/\bmvp\b/i, /\bdpoy\b/i, /\broty\b/i, /award/i, /6moy/i] },
  { slug: "roster-builder", patterns: [/build (a|my|the) (team|roster)/i, /roster builder/i, /\bgm\b/i, /under the cap/i] },
  { slug: "defensive-impact", patterns: [/\bdefense\b/i, /defensive/i, /stopper/i, /rim protect/i] },
  { slug: "iq-quiz", patterns: [/quiz/i, /\biq\b/i, /test my/i, /scenario/i] },
  { slug: "shot-quality", patterns: [/shot quality/i, /good shot/i, /expected points/i, /\bqsq\b/i, /shot value/i] },
];

export function routeCommand(query: string): CommandMatch[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const matches: CommandMatch[] = [];

  for (const intent of INTENTS) {
    const tool = TOOLS.find((t) => t.slug === intent.slug)!;
    let hits = 0;
    let reason = "";
    for (const re of intent.patterns) {
      if (re.test(lower)) {
        hits++;
        if (!reason) reason = `matched “${(lower.match(re) ?? [""])[0]}”`;
      }
    }
    // keyword fallback
    const kw = tool.keywords.filter((k) => lower.includes(k.toLowerCase())).length;
    const confidence = hits * 40 + kw * 18;
    if (confidence > 0) {
      const params = extractPlayers(q);
      matches.push({
        tool,
        confidence: Math.min(99, confidence),
        reason: reason || `keyword: ${tool.keywords.find((k) => lower.includes(k.toLowerCase()))}`,
        href: buildHref(tool.slug, params),
        params,
      });
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return matches.slice(0, 4);
}

function extractPlayers(q: string): Record<string, string> {
  const found = PLAYERS.filter((p) => {
    const last = p.name.split(" ").slice(-1)[0].toLowerCase();
    return q.toLowerCase().includes(p.name.toLowerCase()) || new RegExp(`\\b${last}\\b`, "i").test(q);
  });
  const params: Record<string, string> = {};
  if (found[0]) params.a = found[0].id;
  if (found[1]) params.b = found[1].id;
  const money = q.match(/\$?(\d+)\s?m/i);
  if (money) params.max = money[1];
  return params;
}

function buildHref(slug: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `/tools/${slug}${qs ? `?${qs}` : ""}`;
}

export const EXAMPLE_QUERIES = [
  "Find underrated 3&D wings under $15M",
  "Compare Anthony Edwards to a young Kobe",
  "Who's the most clutch player in the league?",
  "Build the best Lakers lineup",
  "Is Luka better than SGA offensively?",
  "Shot chart for Stephen Curry",
  "MVP race right now",
  "Trade Jokic for Giannis — is it legal?",
];
