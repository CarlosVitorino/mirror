import Sentiment from 'sentiment';

interface SentimentTrend {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface CategorySentiment {
  positive: number;
  neutral: number;
  negative: number;
  averageScore: number;
  sentimentTrend: SentimentTrend[];
}

interface AnalysisResult {
  score: number;
  comparative: number;
  positive: string[];
  negative: string[];
}

export class SentimentAnalyzer {
  private sentiment = new Sentiment();

  analyze(text: string): AnalysisResult {
    return this.sentiment.analyze(text);
  }

  categorizeScore(score: number): 'positive' | 'neutral' | 'negative' {
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  analyzeVideos(videos: Array<{
    title: string;
    description: string;
    time: string;
    category: string;
    subtitles: { name: string }[];
  }>) {
    const titleSentiment = { positive: 0, neutral: 0, negative: 0, byCategory: {} as Record<string, CategorySentiment> };
    const descriptionSentiment = { positive: 0, neutral: 0, negative: 0, byCategory: {} as Record<string, CategorySentiment> };
    const channelSentiment: Record<string, CategorySentiment> = {};

    const initTimeBucket = () => ({ positive: 0, neutral: 0, negative: 0, averageScore: 0 });
    const timeBasedSentiment = {
      daily: Array(24).fill(null).map(initTimeBucket),
      weekly: Array(7).fill(null).map(initTimeBucket),
      monthly: Array(31).fill(null).map(initTimeBucket),
    };

    for (const video of videos) {
      const titleResult = this.analyze(video.title);
      const descResult  = this.analyze(video.description || '');
      const titleCat    = this.categorizeScore(titleResult.score);
      const descCat     = this.categorizeScore(descResult.score);

      titleSentiment[titleCat]++;
      descriptionSentiment[descCat]++;

      const category = video.category || 'Unknown';
      const channel  = video.subtitles?.[0]?.name || 'Unknown';
      const d        = new Date(video.time);
      const hour     = d.getHours();
      const day      = d.getDay();
      const week     = Math.floor(d.getDate()/7);
      const dateStr  = d.toISOString().split('T')[0];

      this.updateCategory(titleSentiment.byCategory,  category, titleCat, titleResult.score, dateStr);
      this.updateCategory(descriptionSentiment.byCategory, category, descCat,  descResult.score,  dateStr);
      this.updateCategory(channelSentiment,              channel,  titleCat, titleResult.score, dateStr);
      this.updateCategory(channelSentiment,              channel,  descCat,  descResult.score,  dateStr);

      const tb = timeBasedSentiment;
      tb.daily[hour][titleCat]++;
      tb.daily[hour][descCat]++;
      tb.weekly[day][titleCat]++;
      tb.weekly[day][descCat]++;
      tb.monthly[week][titleCat]++;
      tb.monthly[week][descCat]++;
      tb.daily[hour].averageScore  += (titleResult.score+descResult.score)/2;
      tb.weekly[day].averageScore += (titleResult.score+descResult.score)/2;
      tb.monthly[week].averageScore += (titleResult.score+descResult.score)/2;
    }

    return { titleSentiment, descriptionSentiment, channelSentiment, timeBasedSentiment };
  }

  private updateCategory(
    target: Record<string, CategorySentiment>,
    key: string,
    sentiment: 'positive' | 'neutral' | 'negative',
    score: number,
    dateStr: string,
  ) {
    if (!target[key]) {
      target[key] = { positive: 0, neutral: 0, negative: 0, averageScore: 0, sentimentTrend: [] };
    }
    const cat = target[key];
    cat[sentiment]++;
    const total = cat.positive + cat.neutral + cat.negative;
    cat.averageScore = ((cat.averageScore*(total-1))+score)/total;
    let trend = cat.sentimentTrend.find(t=>t.date===dateStr);
    if (!trend) { trend = { date: dateStr, positive:0, neutral:0, negative:0 }; cat.sentimentTrend.push(trend); }
    trend[sentiment]++;
  }
}
