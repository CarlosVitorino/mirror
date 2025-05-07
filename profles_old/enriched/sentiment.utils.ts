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
      const descResult = this.analyze(video.description || '');

      const titleCategory = this.categorizeScore(titleResult.score);
      const descCategory = this.categorizeScore(descResult.score);

      titleSentiment[titleCategory]++;
      descriptionSentiment[descCategory]++;

      const category = video.category || 'Unknown';
      const channel = video.subtitles?.[0]?.name || 'Unknown';
      const time = new Date(video.time);
      const hour = time.getHours();
      const day = time.getDay();
      const week = Math.floor(time.getDate() / 7);
      const dateStr = time.toISOString().split('T')[0];

      console.log(`[SentimentAnalyzer] Title: '${video.title}', Hour: ${hour}, Day: ${day}, Week: ${week}`);

      this.updateCategorySentiment(titleSentiment.byCategory, category, titleCategory, titleResult.score, dateStr);
      this.updateCategorySentiment(descriptionSentiment.byCategory, category, descCategory, descResult.score, dateStr);
      this.updateCategorySentiment(channelSentiment, channel, titleCategory, titleResult.score, dateStr);
      this.updateCategorySentiment(channelSentiment, channel, descCategory, descResult.score, dateStr);

      if (!timeBasedSentiment.daily[hour]) timeBasedSentiment.daily[hour] = initTimeBucket();
      if (!timeBasedSentiment.weekly[day]) timeBasedSentiment.weekly[day] = initTimeBucket();
      if (!timeBasedSentiment.monthly[week]) timeBasedSentiment.monthly[week] = initTimeBucket();

      timeBasedSentiment.daily[hour][titleCategory]++;
      timeBasedSentiment.daily[hour][descCategory]++;
      timeBasedSentiment.weekly[day][titleCategory]++;
      timeBasedSentiment.weekly[day][descCategory]++;
      timeBasedSentiment.monthly[week][titleCategory]++;
      timeBasedSentiment.monthly[week][descCategory]++;

      timeBasedSentiment.daily[hour].averageScore += (titleResult.score + descResult.score) / 2;
      timeBasedSentiment.weekly[day].averageScore += (titleResult.score + descResult.score) / 2;
      timeBasedSentiment.monthly[week].averageScore += (titleResult.score + descResult.score) / 2;
    }

    return {
      titleSentiment,
      descriptionSentiment,
      channelSentiment,
      timeBasedSentiment,
    };
  }

  private updateCategorySentiment(
    target: Record<string, CategorySentiment>,
    key: string,
    sentiment: 'positive' | 'neutral' | 'negative',
    score: number,
    dateStr: string
  ) {
    if (!target[key]) {
      target[key] = {
        positive: 0,
        neutral: 0,
        negative: 0,
        averageScore: 0,
        sentimentTrend: [],
      };
    }

    const cat = target[key];
    cat[sentiment]++;

    const total = cat.positive + cat.neutral + cat.negative;
    cat.averageScore = ((cat.averageScore * (total - 1)) + score) / total;

    let trend = cat.sentimentTrend.find(t => t.date === dateStr);
    if (!trend) {
      trend = { date: dateStr, positive: 0, neutral: 0, negative: 0 };
      cat.sentimentTrend.push(trend);
    }

    trend.positive = trend.positive || 0;
    trend.neutral = trend.neutral || 0;
    trend.negative = trend.negative || 0;
    trend[sentiment]++;
  }
}
