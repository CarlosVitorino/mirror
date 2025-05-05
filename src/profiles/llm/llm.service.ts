// -----------------------------------------------------------------------------
// High‑level overview
// -----------------------------------------------------------------------------
// 1. Build a **compact behavioural snapshot** from an EnrichedProfile.
// 2. Send the snapshot to the OpenAI Chat API and parse the response.
// 3. Persist the generated insights.
//
// Diagnostic additions (2025‑05‑05)
// ───────────────────────────────
// • Verbose timing logs for every expensive step.
// • Snapshot size + rough token count in logs.
// • Caught errors re‑thrown after logging.
// -----------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { subDays, differenceInCalendarDays } from 'date-fns';

import { LlmProfile } from './llm.entity';
import { EnrichedProfile } from '../enriched/enriched.entity';

// -----------------------------------------------------------------------------
// Public type contracts
// -----------------------------------------------------------------------------

type TimeframeKey =
  | 'overall'
  | 'last12Months'
  | 'last6Months'
  | 'last30Days'
  | 'last7Days';

type InsightPayload = {
    narrativeSummary: string;                         // 1-3 rich paragraphs
    traits: { name: string; score: number }[];        // 5-7 radar points (0-1)
    suggestedShifts: string[];                        // 3-5 tips
    faq: { question: string; answer: string }[];      // 3-5 Q&A pairs
    visualMetaphor?: string;                          // optional short description
};

type PublicProfile = Omit<LlmProfile, 'enrichedProfile'>;


interface FrameStats {
  totals: {
    videos: number;
    watchTimeMin: number;
  };
  topCategories: Array<{ category: string; count: number; pct: number }>;
  topChannels: Array<{ channel: string; count: number; pct: number }>;
  sentiment: { posPct: number; neuPct: number; negPct: number };
  engagement: {
    avgSessionMin: number;
    peakHour: number;
    peakWeekday: number;
  };
  highlights: string[];
}

interface SnapshotPayload {
  v: 1;
  userBio: {
    age?: number;
    country?: string;
    languages?: string[];
    occupation?: string;
    hobbies?: string[];
  };
  timeframes: Record<TimeframeKey, FrameStats>;
  evidenceHints?: {
    /**
     *  Key-value snippets the prompt can quote verbatim.
     *  Keep them SHORT so they don’t blow up tokens.
     */
    topFacts: string[];               // ≤ 10 “fun-fact” strings
    trendAlerts: string[];            // e.g. "Science ↑ +34 % vs last 6 mo"
    exemplarVideos: Array<{
      title: string;
      category: string;
    }>;                               // ≤ 3 highly representative videos
  };
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const VERSION = 1 as const;

const MODEL = 'gpt-4o'; // Adjust to your preferred model

/**
 * Days included in each timeframe ("overall" handled separately).
 */
const TIMEFRAME_WINDOWS: Record<Exclude<TimeframeKey, 'overall'>, number> = {
  last12Months: 365,
  last6Months: 183,
  last30Days: 30,
  last7Days: 7,
};

const MAX_TOP_ITEMS = 7 as const;
const HIGHLIGHT_LIMIT = 5 as const;

const SYSTEM_PROMPT = `
You are a senior psychological content analyst.

Return *only* a JSON object matching this exact TypeScript type:

{
  narrativeSummary: string;                       // 1-3 paragraphs, first-person
  traits: { name: string; score: number }[];      // 5-7 entries, score ∈ [0,1]
  suggestedShifts: string[];                      // 3-5 short tips
  faq: { question: string; answer: string }[];    // 3-5 Q-&-A pairs
  visualMetaphor?: string;                        // optional one-sentence simile
}

✦ Ground every assertion in explicit evidence ✦
• Quote numbers, percentages or facts that appear *verbatim* in the snapshot
  (look inside \`evidenceHints\` and the per-timeframe stats).
• In **narrativeSummary** weave the evidence naturally, e.g.
  “I’m someone who seeks intellectual stimulation
   (62 % of my recent watch-time is educational).”
• In **traits** keep \`name\` clean (no evidence there) but
  start each *faq.answer* with one evidence sentence:
  “Because I watch mostly at 23:00 – 01:00, …”

Tone:
• Warm, affirming, non-judgmental. No moralising.
• Avoid speculation beyond the snapshot. If data is thin, say so.

Format rules:
• Pure JSON – no markdown, no comments, no trailing commas.
• Do **not** add or omit properties; keep the declared schema.
`.trim();

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

@Injectable()
export class LlmProfileService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(LlmProfileService.name);

  constructor(
    @InjectRepository(LlmProfile)
    private readonly repo: Repository<LlmProfile>,
    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: this.config.get('OPENAI_API_KEY') });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async generateFromEnriched(
    enriched: EnrichedProfile,
    userBio: SnapshotPayload['userBio'] = {},
  ): Promise<PublicProfile> {
    const globalStart = Date.now();
    this.logger.verbose('▶ generateFromEnriched() called');

    // 1 ── Build snapshot ------------------------------------------------------
    const t0 = Date.now();
    const snapshot = buildSnapshot(enriched, userBio);
    const buildMs = Date.now() - t0;
    const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot));
    const approxTokens = Math.round(snapshotBytes / 4); // rough rule‑of‑thumb
    this.logger.verbose(`Snapshot built in ${buildMs} ms  –  ${snapshotBytes} B ≈ ${approxTokens} tokens`);

    // 2 ── Call OpenAI ---------------------------------------------------------
    const t1 = Date.now();
    const chatResponse = await this.callOpenAi(snapshot);
    const openAiMs = Date.now() - t1;
    this.logger.verbose(`OpenAI responded in ${openAiMs} ms`);

    // 3 ── Persist -------------------------------------------------------------
    const t2 = Date.now();

    const entity = this.repo.create({
      enrichedProfile: enriched,
      radarTraits:       chatResponse.traits,
      narrativeSummary:  chatResponse.narrativeSummary,
      suggestedShifts:   chatResponse.suggestedShifts,
      faqs:              chatResponse.faq,
      visualMetaphor:    chatResponse.visualMetaphor ?? null,
    });
    const saved = await this.repo.save(entity);
    const dbMs = Date.now() - t2;
    this.logger.verbose(`Saved insights in ${dbMs} ms`);
    this.logger.verbose(`✔ generateFromEnriched() total ${Date.now() - globalStart} ms`);
    const { enrichedProfile: _hidden, ...publicProfile } = saved;

    return publicProfile as PublicProfile;
  
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async callOpenAi(payload: SnapshotPayload) {
    const timer = Date.now();
    this.logger.verbose('Calling OpenAI …');

    try {
        const response = await this.openai.chat.completions.create({
            model: MODEL,
            temperature: 0.4,        // ↓ a bit for more factual anchoring
            top_p: 0.95,             // default, but explicit
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                  role: 'user',
                  content: `Here is my behavioural snapshot JSON:\n\n${JSON.stringify(payload)}`,
                },
              ],
              response_format: { type: 'json_object' },
              max_tokens: 800          
          });
    
          this.logger.verbose(`OpenAI call took ${Date.now() - timer} ms`);
          const raw = response.choices[0].message.content ?? '{}';
          const insights = JSON.parse(raw) as InsightPayload;
          return insights;
        
    } catch (error: any) {
      /**
       * 403 is the most common "Forbidden" coming back from OpenAI
       * (no quota, model not whitelisted, policy violation). Log the
       * full HTTP payload so we can see *why*.
       */
      if (error instanceof OpenAI.APIError) {
        this.logger.error(
          `OpenAI API error ${error.status} – ${error.code ?? 'no_code'}: ${error.message}`,
        );
        this.logger.debug(error); // includes full requestId + policy info
      } else {
        this.logger.error('Unexpected error talking to OpenAI', error);
      }
      throw error; // Let NestJS exception layer turn it into 500/4xx
    }
  }
}

// -----------------------------------------------------------------------------
// Stand‑alone pure functions (unit‑test friendly) -----------------------------
// -----------------------------------------------------------------------------

function buildSnapshot(
  enriched: EnrichedProfile,
  userBio: SnapshotPayload['userBio'],
): SnapshotPayload {
  const start = Date.now();

  const frames = createTimeframeFilters();
  const sentimentSum = sumSentiments(
    enriched.sentimentAnalysis.titleSentiment.byCategory,
  );

  const timeframes = Object.fromEntries(
    Object.entries(frames).map(([key, filter]) => {
      const stats = buildFrameStats(enriched, filter, sentimentSum, key as TimeframeKey);
      return [key, stats];
    }),
  ) as Record<TimeframeKey, FrameStats>;

  const duration = Date.now() - start;

  const overall    = timeframes.overall;      // the biggest picture
  const last30Days = timeframes.last30Days;   // fresh momentum

  // ── 2. Top-facts (max 10 very short strings) ────────────────────────────
  const topFacts: string[] = [
    `🔢 ${(overall.totals.watchTimeMin/60).toFixed(1)} h total watch-time`,
    `🕒 Peak viewing hour = ${overall.engagement.peakHour}`,
    `🙂 Pos-title ratio last 30 d = ${(last30Days.sentiment.posPct*100).toFixed(0)} %`,
    `🎬 ${overall.topCategories[0]?.category ?? '–'} is #1 category (${(overall.topCategories[0]?.pct*100||0).toFixed(0)} %)`
  ].filter(Boolean).slice(0,10);

  // ── 3. Trend alerts (compare watch-time pct vs previous 6 mo) ───────────
  const trendAlerts = buildTrendAlerts(timeframes);

  // ── 4. Exemplar videos (3 that best represent the dominant category) ────
  const exemplarVideos = pickExemplarVideos(
    enriched.enrichedWatchHistory,
    overall.topCategories.map(c => c.category),
    3
  );

  // ── 5. Attach to snapshot (harmless for downstream consumers) ───────────
  const evidenceHints = { topFacts, trendAlerts, exemplarVideos } as const;


  // Note: cannot use logger here (no DI), but useful in unit tests.
  console.debug(`buildSnapshot() finished in ${duration} ms`);

  return { v: VERSION, userBio, timeframes, evidenceHints };
}

function createTimeframeFilters(): Record<TimeframeKey, (d: Date) => boolean> {
  const now = new Date();
  return {
    overall: () => true,
    last12Months: (d: Date) => d >= subDays(now, TIMEFRAME_WINDOWS.last12Months),
    last6Months: (d: Date) => d >= subDays(now, TIMEFRAME_WINDOWS.last6Months),
    last30Days: (d: Date) => d >= subDays(now, TIMEFRAME_WINDOWS.last30Days),
    last7Days: (d: Date) => d >= subDays(now, TIMEFRAME_WINDOWS.last7Days),
  };
}

function buildFrameStats(
  enriched: EnrichedProfile,
  filter: (d: Date) => boolean,
  sentimentSum: { positive: number; neutral: number; negative: number },
  frameKey: TimeframeKey,
): FrameStats {
  const stepStart = Date.now();

  const vids = enriched.enrichedWatchHistory.filter((v) => filter(new Date(v.time)));

  const totals = {
    videos: vids.length,
    watchTimeMin: vids.reduce((sum, v) => sum + Number(v.duration) / 60, 0),
  } as const;

  const topCategories = toTopArray(aggregateByKey(vids, 'category'), vids.length).map(({ key, count, pct }) => ({
    category: key,
    count,
    pct,
  }));

  const topChannels = toTopArray(aggregateByKey(vids, 'channelTitle'), vids.length).map(({ key, count, pct }) => ({
    channel: key,
    count,
    pct,
  }));

  const sentiment = toPercentages(sentimentSum);
  const engagement = buildEngagement(vids, enriched);
  const highlights = buildHighlights({ totals, sentiment, topCategories, vids, frameKey });

  console.debug(`frameStats(${frameKey}) built in ${Date.now() - stepStart} ms`);

  return { totals, topCategories, topChannels, sentiment, engagement, highlights };
}

// ---------------------------------------------------------------------------
// Smaller pure helpers (no additional logging; called many times) ------------
// ---------------------------------------------------------------------------

function aggregateByKey<T extends Record<string, any>>(arr: T[], key: keyof T): Map<string, number> {
  return arr.reduce<Map<string, number>>((map, item) => {
    const k = String(item[key]);
    map.set(k, (map.get(k) ?? 0) + 1);
    return map;
  }, new Map());
}

function toTopArray(map: Map<string, number>, total: number) {
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_TOP_ITEMS)
    .map(([key, count]) => ({ key, count, pct: +((count / total) || 0).toFixed(3) }));
}

function toPercentages(sum: { positive: number; neutral: number; negative: number }) {
  const total = sum.positive + sum.neutral + sum.negative || 1;
  const toPct = (v: number) => +(v / total).toFixed(3);
  return { posPct: toPct(sum.positive), neuPct: toPct(sum.neutral), negPct: toPct(sum.negative) };
}

function buildEngagement(
  vids: EnrichedProfile['enrichedWatchHistory'],
  enriched: EnrichedProfile,
) {
  const hours = vids.map((v) => new Date(v.time).getHours());
  const weekdays = vids.map((v) => new Date(v.time).getDay());
  return {
    avgSessionMin: enriched.engagementPatterns.categoryEngagement.averageSessionLength ?? 0,
    peakHour: mode(hours),
    peakWeekday: mode(weekdays),
  } as const;
}

function buildHighlights(params: {
  totals: { videos: number };
  sentiment: { negPct: number };
  topCategories: Array<{ category: string }>;
  vids: EnrichedProfile['enrichedWatchHistory'];
  frameKey: TimeframeKey;
}): string[] {
  const { totals, sentiment, topCategories, vids, frameKey } = params;
  const now = new Date();
  const highlights: string[] = [];

  if (totals.videos > 100 && frameKey === 'last7Days')
    highlights.push(`I watched ${totals.videos} videos in the past week — a personal high.`);

  if (sentiment.negPct > 0.5)
    highlights.push('My recent video titles have skewed negative in tone.');

  const newestVideo = vids.at(-1);
  if (newestVideo &&
      topCategories[0] &&
      differenceInCalendarDays(now, new Date(newestVideo.time)) < 2) {
    highlights.push(`Just discovered a new interest in •${topCategories[0].category}•.`);
  }

  return highlights.slice(0, HIGHLIGHT_LIMIT);
}

function sumSentiments(byCategory: Record<string, { positive: number; neutral: number; negative: number }>) {
  return Object.values(byCategory).reduce(
    (acc, cur) => ({
      positive: acc.positive + cur.positive,
      neutral: acc.neutral + cur.neutral,
      negative: acc.negative + cur.negative,
    }),
    { positive: 0, neutral: 0, negative: 0 },
  );
}

function mode(arr: number[]): number {
  if (arr.length === 0) return 0;
  const frequency = new Map<number, number>();
  for (const value of arr) frequency.set(value, (frequency.get(value) ?? 0) + 1);
  return [...frequency.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function buildTrendAlerts(frames: Record<TimeframeKey, FrameStats>) {
  // Compare “last6Months” vs “last12Months – last6Months”
  const recent  = frames.last6Months.topCategories;
  const earlier = frames.last12Months.topCategories;

  const alerts: string[] = [];

  for (const { category, pct } of recent) {
    const prev = earlier.find(c => c.category === category)?.pct ?? 0;
    const delta = +(pct - prev).toFixed(3);

    if (delta >= 0.05)      alerts.push(`📈 ${category} ↑ ${(delta*100).toFixed(0)} % vs prior 6 mo`);
    else if (delta <= -0.05) alerts.push(`📉 ${category} ↓ ${Math.abs(delta*100).toFixed(0)} % vs prior 6 mo`);
  }

  return alerts.slice(0, 5);   // keep it concise
}

function pickExemplarVideos(
  vids: EnrichedProfile['enrichedWatchHistory'],
  preferredCategories: string[],
  max: number
) {
  // Greedy pick: latest video per preferred category (in priority order)
  const chosen: typeof vids = [];

  for (const cat of preferredCategories) {
    const match = vids.reverse().find(v => v.category === cat);
    if (match) chosen.push(match);
    if (chosen.length >= max) break;
  }

  return chosen.map(v => ({
    title: v.title,
    category: v.category,
  }));
}
