import { LlmTransformer, LlmPayload } from './llm-transformer';
import { OpenAIUtil } from './utils/openai-util';
import { DataSource } from '../../../shared/data-source';
import { Digest } from '../../digest/digest.types';
import { EnrichedPayload } from '../enriched/enriched-transformer';

const SYSTEM_PROMPT = `
You are a senior psychological-profiling engine.

────────────────────────────────────────────
📥 INPUT
────────────────────────────────────────────
A single JSON object that matches \`YoutubeBehavioralSnapshot\`
(schema described in comments ↓).  It contains:

• userBio                → static demographics & interests
• timeframes.overall     → lifetime behaviour
• timeframes.last12Months
• timeframes.last6Months
• timeframes.last30Days
• timeframes.last7Days   → freshest behaviour
• evidenceHints          → hand-picked “copy & paste” facts

────────────────────────────────────────────
📤 OUTPUT (STRICT)
────────────────────────────────────────────
Return **only** a JSON object of this shape:

{
  "narrativeSummary":   string,                         // 1-3 paragraphs, **2nd person** (“You are …”)
  "traits":             { name: string, score: number }[],  // 7 fixed entries, score ∈ [0,1] — see ⬇︎ recipe
  "suggestedShifts":    string[],                       // 3-5 concise tips
  "faq":                { question: string, answer: string }[], // 3-5 Q&A pairs; answers begin with evidence
  "visualMetaphor":     string | null                   // optional one-sentence simile
}

No extra keys, no markdown, no comments, no trailing commas.

────────────────────────────────────────────
✦ GUIDELINES
────────────────────────────────────────────
1. **Evidence grounding**  
   Quote numbers or phrases that appear verbatim in \`evidenceHints\` or
   any timeframe stats.  Weave them naturally:
   “You are highly curious — 62 % of your recent watch-time is educational.”

2. **Second-person voice**  
   All prose must address the user as **“You”**, never “I”.

3. **Focus on the person**  
   Use YouTube patterns only as signals about personality
   (motivation, emotion regulation, learning style, discipline, social drive …).

4. **FAQ answers**  
   Open each answer with one grounding fact:  
   “Because 57 % of your viewing happens after 23:00, …”

5. **Tone**  
   Warm, affirming, non-judgmental, yet confident and specific.
   If data is sparse, state that explicitly.

────────────────────────────────────────────
📐 TRAIT SCAFFOLD (fixed 7-axis radar)
────────────────────────────────────────────
Always return the *same seven* trait objects in this order:

1. "Curiosity"            // appetite for new information
2. "Emotional Intensity"  // proportion & polarity of strong-valence content
3. "Self-Discipline"      // consistency of session length & peak-time habits
4. "Social Orientation"   // share of community / commentary / collab content
5. "Escapism"             // late-night binges, fantasy genres, mood dips
6. "Learning Drive"       // instructional & long-form ratio
7. "Exploration Breadth"  // diversity across categories & channels

Score each on 0-to-1 using the **standard recipe below**.
If evidence is insufficient for a trait, return 0.5 and mention uncertainty.

────────────────────────────────────────────
🧮 STANDARD SCORING RECIPE
────────────────────────────────────────────
For each trait compute a *raw z-score* inside the LLM:

  z = (metric – pop_mean) / pop_std

…then convert to bounded 0–1:

  score = 1 / (1 + exp(-z))

**Metrics per trait**

• Curiosity:     entropy of category distribution in last30Days  
• Emotional Intensity:  (posPct + negPct) / totalSentiment in last7Days  
• Self-Discipline:  1 – stddev(session length minutes, last30Days)  
• Social Orientation:  fraction of videos with “comment”, “podcast”, or “react” in title  
• Escapism:       share of videos watched between 23-05 h + fantasy / gaming categories  
• Learning Drive: share of “Education”, “How-to” + avg watchTimeMin > 10  
• Exploration Breadth: uniqueChannels / totalVideos in last6Months

Use overall timeframe when a narrower window has < 30 videos.

────────────────────────────────────────────
⚠️ STRICT FORMAT
────────────────────────────────────────────
Pure JSON.  No markdown fences, no comments.
`.trim();



const OPENAI_CONFIG = {
  prompt: SYSTEM_PROMPT,
  model: 'gpt-4o',
  temperature: 0.4,
  max_tokens: 800,
  top_p: 0.95,
  frequency_penalty: 0,
  presence_penalty: 0,
  stop: ['\n\n'],
};

export interface YoutubeBehavioralSnapshot {
  v: number;
  userBio: {
    age: string | number;
    country: string;
    languages: string[];
    occupation: string;
    hobbies: string[];
  };
  timeframes: {
    [key: string]: {
      totals: {
        videos: number;
        watchTimeMin: number;
      };
      topCategories: Array<{
        category: string;
        count: number;
        pct: number; // 0–1
      }>;
      topChannels: Array<{
        channel: string;
        count: number;
        pct: number; // 0–1
      }>;
      sentiment: {
        posPct: number; // 0–1
        neuPct: number; // 0–1
        negPct: number; // 0–1
      };
      engagement: {
        avgSessionMin: number;
        peakHour: number;    // 0–23
        peakWeekday: number; // 0=Sunday, 6=Saturday
      };
      highlights: string[];
    };
  };
  evidenceHints: {
    topFacts: string[];
    trendAlerts: string[];
    exemplarVideos: Array<{
      title: string;
      category: string;
    }>;
  };
}


// --- Pure helpers migrated from old llm.service.ts (adapted for EnrichedPayload) ---

function createTimeframeFilters(now: Date) {
  const subDays = (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  const TIMEFRAME_WINDOWS = {
    last12Months: 365,
    last6Months: 183,
    last30Days: 30,
    last7Days: 7,
  };
  return {
    overall: () => true,
    last12Months: (d: Date) => d >= subDays(now, TIMEFRAME_WINDOWS.last12Months),
    last6Months: (d: Date) => d >= subDays(now, TIMEFRAME_WINDOWS.last6Months),
    last30Days: (d: Date) => d >= subDays(now, TIMEFRAME_WINDOWS.last30Days),
    last7Days: (d: Date) => d >= subDays(now, TIMEFRAME_WINDOWS.last7Days),
  };
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

function aggregateByKey<T extends Record<string, any>>(arr: T[], key: keyof T): Map<string, number> {
  return arr.reduce<Map<string, number>>((map, item) => {
    const k = String(item[key]);
    map.set(k, (map.get(k) ?? 0) + 1);
    return map;
  }, new Map());
}

function toTopArray(map: Map<string, number>, total: number) {
  const MAX_TOP_ITEMS = 10;
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

function mode(arr: number[]): number {
  if (arr.length === 0) return 0;
  const frequency = new Map<number, number>();
  for (const value of arr) frequency.set(value, (frequency.get(value) ?? 0) + 1);
  return [...frequency.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function buildEngagement(
  vids: any[],
  enriched: EnrichedPayload,
) {
  const hours = vids.map((v) => new Date(v.time).getHours());
  const weekdays = vids.map((v) => new Date(v.time).getDay());
  return {
    avgSessionMin: enriched.engagementPatterns?.categoryEngagement?.averageSessionLength ?? 0,
    peakHour: mode(hours),
    peakWeekday: mode(weekdays),
  } as const;
}

function buildHighlights(params: {
  totals: { videos: number };
  sentiment: { posPct?: number; negPct?: number; neuPct?: number };
  topCategories: Array<{ category: string; count?: number; pct?: number }>;
  vids: any[];
  frameKey: string;
}): string[] {
  const { totals, sentiment, topCategories, vids, frameKey } = params;
  const now = new Date();
  const highlights: string[] = [];

  if (!vids.length) return highlights;

  // Average watch time per video
  const totalMinutes = vids.reduce((sum, v) => {
    const duration = typeof v.duration === 'number' ? v.duration / 60 : parseISODurationToMinutes(v.duration);
    return sum + (Number.isFinite(duration) ? duration : 0);
  }, 0);
  const avgMinutes = (totalMinutes / vids.length).toFixed(1);
  highlights.push(`Avg. watch time per video: ${avgMinutes} min`);

  // Most-watched channel
  const channelCounts = new Map();
  for (const v of vids) {
    if (v.channelTitle) channelCounts.set(v.channelTitle, (channelCounts.get(v.channelTitle) || 0) + 1);
  }
  const sortedChannels = [...channelCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (sortedChannels.length) {
    const [topChannel, count] = sortedChannels[0];
    const pct = ((count / vids.length) * 100).toFixed(0);
    highlights.push(`Most-watched channel: ${topChannel} (${pct}% of videos)`);
  }

  // Most-watched category
  if (topCategories[0]?.category) {
    const catPct = ((topCategories[0].pct ?? 0) * 100).toFixed(0);
    highlights.push(`Top category: ${topCategories[0].category} (${catPct}%)`);
  }

  // Sentiment breakdown
  if (sentiment.posPct !== undefined && sentiment.negPct !== undefined && sentiment.neuPct !== undefined) {
    highlights.push(`Sentiment: ${Math.round((sentiment.posPct||0)*100)}% positive, ${Math.round((sentiment.neuPct||0)*100)}% neutral, ${Math.round((sentiment.negPct||0)*100)}% negative`);
  }

  // Streak: consecutive days with activity
  const days = Array.from(new Set(vids.map(v => new Date(v.time).toISOString().slice(0,10)))).sort();
  let maxStreak = 0, curStreak = 1;
  for (let i = 1; i < days.length; ++i) {
    const prev = new Date(days[i-1]);
    const curr = new Date(days[i]);
    if ((curr.getTime() - prev.getTime()) <= 24*60*60*1000 + 1000) curStreak++;
    else curStreak = 1;
    if (curStreak > maxStreak) maxStreak = curStreak;
  }
  if (maxStreak > 1) highlights.push(`Longest daily streak: ${maxStreak} days`);

  // Recent interest (if newest video is in a new category)
  const newestVideo = vids.at(-1);
  if (newestVideo && topCategories[0]) {
    const videoDate = new Date(newestVideo.time);
    const frameStart = vids.length ? new Date(vids[0].time) : now;
    const frameDuration = now.getTime() - frameStart.getTime();
    if (frameDuration > 0 && (now.getTime() - videoDate.getTime()) < frameDuration * 0.1) {
      highlights.push(`Recent interest in •${topCategories[0].category}•`);
    }
  }

  // High volume
  if (totals.videos > 100) {
    highlights.push(`High activity: ${totals.videos} videos in ${frameKey.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
  }

  return highlights.slice(0, 5);
}

function buildTrendAlerts(frames: Record<string, any>) {
  // Compare “last6Months” vs “last12Months – last6Months”
  const recent  = frames.last6Months.topCategories;
  const earlier = frames.last12Months.topCategories;
  const alerts: string[] = [];
  for (const { category, pct } of recent) {
    const prev = earlier.find((c: any) => c.category === category)?.pct ?? 0;
    const delta = +(pct - prev).toFixed(3);
    if (delta >= 0.05)      alerts.push(`📈 ${category} ↑ ${(delta*100).toFixed(0)} % vs prior 6 mo`);
    else if (delta <= -0.05) alerts.push(`📉 ${category} ↓ ${Math.abs(delta*100).toFixed(0)} % vs prior 6 mo`);
  }
  return alerts.slice(0, 5);
}

function pickExemplarVideos(
  vids: any[],
  preferredCategories: string[],
  max: number
) {
  // Greedy pick: latest video per preferred category (in priority order)
  const chosen: typeof vids = [];
  for (const cat of preferredCategories) {
    const match = vids.slice().reverse().find((v: any) => v.category === cat);
    if (match) chosen.push(match);
    if (chosen.length >= max) break;
  }
  return chosen.map((v: any) => ({
    title: v.title,
    category: v.category,
  }));
}

function buildSnapshot(enriched: EnrichedPayload, userBio: any) {
  const start = Date.now();
  const frames = createTimeframeFilters(new Date());
  const sentimentSum = sumSentiments(enriched.sentimentAnalysis?.titleSentiment?.byCategory || {});
  const timeframes = Object.fromEntries(
    Object.entries(frames).map(([key, filter]) => {
      // Only include videos with a valid category or categoryId for category-based calculations
      const vidsRaw = enriched.enrichedWatchHistory?.filter((v: any) => filter(new Date(v.time))) || [];
      const vidsNoPub = vidsRaw.filter((v: any) => v.category || v.categoryId);
      // For totals, use all vids; for category-based, use vidsWithCategory
      const totals = {
        videos: vidsRaw.length,
        watchTimeMin: vidsRaw.reduce((sum: number, v: any) => {
          const min = parseISODurationToMinutes(v.duration);
          return Number.isFinite(min) ? sum + min : sum;
        }, 0),
      };



      const topCategories = toTopArray(aggregateByKey(vidsNoPub, 'category'), vidsNoPub.length).map(({ key, count, pct }) => ({
        category: key, count, pct
      }));
      const topChannels = toTopArray(aggregateByKey(vidsNoPub, 'channelTitle'), vidsNoPub.length).map(({ key, count, pct }) => ({
        channel: key, count, pct
      }));
      const sentiment = toPercentages(sentimentSum);
      const engagement = buildEngagement(vidsNoPub, enriched);
      const highlights = buildHighlights({ totals, sentiment, topCategories, vids: vidsNoPub, frameKey: key });
      return [key, { totals, topCategories, topChannels, sentiment, engagement, highlights }];
    })
  );
  const overall    = timeframes.overall;
  const last30Days = timeframes.last30Days;

  const uniqueChannels = new Set(enriched.enrichedWatchHistory?.map((v: any) => v.channelTitle)).size;
  const uniqueCategories = new Set(enriched.enrichedWatchHistory?.filter((v: any) => v.category).map((v: any) => v.category)).size;
  const mostWatchedChannel = overall.topChannels[0]?.channel;
  const mostWatchedChannelPct = (overall.topChannels[0]?.pct * 100 || 0).toFixed(0);
  const avgSessionMin = (overall.totals.watchTimeMin / (overall.totals.videos || 1)).toFixed(1);
  // Map peakWeekday (0-6) to day name
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const peakDay = typeof overall.engagement?.peakWeekday === 'number' ? weekdayNames[overall.engagement.peakWeekday] : '–';
  const posPct = (overall.sentiment.posPct * 100).toFixed(0);
  const negPct = (overall.sentiment.negPct * 100).toFixed(0);
  const neutralPct = (overall.sentiment.neuPct * 100).toFixed(0);
  const last30TopCat = last30Days.topCategories[0]?.category;
  const last30TopCatPct = (last30Days.topCategories[0]?.pct * 100 || 0).toFixed(0);

  // Find the earliest video date (for 'since' info)
  const allVideos = enriched.enrichedWatchHistory || [];
  const earliestVideo = allVideos.reduce((min: Date | null, v: any) => {
    const dt = v.time ? new Date(v.time) : null;
    return (!min || (dt && dt < min)) ? dt : min;
  }, null as Date | null);
  const sinceStr = earliestVideo ? `since ${earliestVideo.toISOString().slice(0, 10)}` : '';
  // Watch time in the last 30 days
  const last30WatchTimeH = isNaN(last30Days.totals.watchTimeMin) ? '0.0' : (last30Days.totals.watchTimeMin/60).toFixed(1);
  const totalWatchTimeH = isNaN(overall.totals.watchTimeMin) ? '0.0' : (overall.totals.watchTimeMin/60).toFixed(1);

  const topFacts: string[] = [
    `🔢 ${totalWatchTimeH} h total watch-time ${sinceStr} | ${last30WatchTimeH} h in last 30d`,
    `🕒 Peak viewing hour: ${typeof overall.engagement?.peakHour === 'number' ? overall.engagement.peakHour + ':00' : '–'}`,
    `📅 Most active day: ${peakDay ?? '–'}`,
    `⏱️ Avg session: ${avgSessionMin} min/video`,
    `📺 Watched ${overall.totals.videos} videos from ${uniqueChannels} unique channels`,
    `🏆 Most-watched channel: ${mostWatchedChannel} (${mostWatchedChannelPct}%)`,
    `🎬 #1 category: ${overall.topCategories[0]?.category ?? '–'} (${(overall.topCategories[0]?.pct*100||0).toFixed(0)}%)`,
    `🗂️ Explored ${uniqueCategories} different categories`,
    `🙂 Sentiment: ${posPct}% positive, ${negPct}% negative, ${neutralPct}% neutral`,
    `🔄 Last 30d #1 category: ${last30TopCat ?? '–'} (${last30TopCatPct}%)`,
    // Add more as needed...
  ].filter(Boolean).slice(0, 10);
  const trendAlerts = buildTrendAlerts(timeframes);
  const exemplarVideos = pickExemplarVideos(
    enriched.enrichedWatchHistory?.filter((v: any) => v.category || v.categoryId) || [],
    (overall.topCategories || []).map((c: any) => c.category),
    3
  );
  const evidenceHints = { topFacts, trendAlerts, exemplarVideos } as const;
  return { v: 1, userBio, timeframes, evidenceHints };
}


// --- Main transformer class ---

export class YoutubeLlmTransformer implements LlmTransformer {
  constructor(private readonly openaiUtil: OpenAIUtil) {}
  accepts(source: DataSource) {
    return source === DataSource.YouTube;
  }

  async run({ digest, enriched }: { digest: Digest; enriched: EnrichedPayload }): Promise<LlmPayload> {
    // 1. Build behavioral snapshot
    let insights = {} as LlmPayload;
    const userBio = {
      age: "38",
      country: "Germany",
      languages: ["Portuguese", "English"],
      occupation: "Software Engineer",
      hobbies: ["Bouldering", "Coding", "Traveling"],
    };
    const snapshot = buildSnapshot(enriched, userBio);
    console.log('snapshot', snapshot);

    // 2. Call OpenAI LLM with snapshot as prompt

    let topics: string[] = [];
    try {
       const result: string = await this.openaiUtil.chatCompletion({
        prompt: OPENAI_CONFIG.prompt,
        payload: snapshot,
        model: OPENAI_CONFIG.model,
        temperature: OPENAI_CONFIG.temperature,
        max_tokens: OPENAI_CONFIG.max_tokens,
        top_p: OPENAI_CONFIG.top_p,
        frequency_penalty: OPENAI_CONFIG.frequency_penalty,
        presence_penalty: OPENAI_CONFIG.presence_penalty,
        stop: OPENAI_CONFIG.stop,
      });

      insights = JSON.parse(result);
      
    } catch (err) {
      console.error('OpenAIUtil error:', err);
    }
    console.log('insights: ', insights);
    return insights;
  }
}

// Helper: Parse ISO 8601 duration (e.g., 'PT14M8S') to minutes
function parseISODurationToMinutes(duration: string | number | undefined): number {
  if (typeof duration === 'number' && Number.isFinite(duration)) return duration / 60;
  if (typeof duration !== 'string') return 0;
  // Regex for ISO 8601 durations
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const match = duration.match(regex);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 60 + minutes + seconds / 60;
}