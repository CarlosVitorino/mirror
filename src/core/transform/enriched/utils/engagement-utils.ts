export function analyzeEngagementPatterns(videos: any[]): any {
    // simplified – identical maths from old service but w/o TypeORM deps
    const categoryCount: Record<string, number> = {};
    const daily: Record<number, { count: number; totalDuration: number }> = {};
    const weekly: Record<number, { count: number; totalDuration: number }> = {};
    const monthly: Record<number, { count: number; totalDuration: number }> = {};
    const totalDurations: number[] = [];
    const bingeSessions: any[] = [];
    let session: any = null;
    const maxGap = 1000*60*60; // 1 h
  
    const sorted = [...videos].sort((a,b)=>new Date(a.time).getTime()-new Date(b.time).getTime());
    for (const v of sorted) {
      const dur = parseDuration(v.duration);
      const t   = new Date(v.time);
      const h   = t.getHours();
      const d   = t.getDay();
      const w   = Math.floor(t.getDate()/7);
      const cat = v.category||'Unknown';
  
      categoryCount[cat] = (categoryCount[cat]??0)+1;
      (daily[h]   ??= {count:0,totalDuration:0}).count++;
      daily[h].totalDuration   += dur;
      (weekly[d] ??= {count:0,totalDuration:0}).count++;
      weekly[d].totalDuration  += dur;
      (monthly[w]??= {count:0,totalDuration:0}).count++;
      monthly[w].totalDuration += dur;
      totalDurations.push(dur);
  
      const ts = t.getTime();
      if (!session) session = startSession(v,dur,cat);
      else if (ts - new Date(session.endTime).getTime() <= maxGap) extendSession(session,v,dur,cat);
      else { bingeSessions.push(session); session = startSession(v,dur,cat); }
    }
    if (session) bingeSessions.push(session);
  
    const peakHours = toTopArray(daily,3,'hour');
    const avgSession = totalDurations.reduce((a,b)=>a+b,0)/(totalDurations.length||1);
    return {
      bingeSessions,
      peakActivity: {
        daily:   toTimeData(daily,'hour'),
        weekly:  toTimeData(weekly,'day'),
        monthly: toTimeData(monthly,'week'),
      },
      categoryEngagement: {
        totalWatchTime: totalDurations.reduce((a,b)=>a+b,0),
        averageSessionLength: avgSession,
        peakHours,
        categoryDistribution: Object.fromEntries(Object.entries(categoryCount).map(([c,count])=>[c,{ watchCount:count, totalDuration:0, averageSessionLength:avgSession, peakHours }]))
      }
    };
  
    function toTopArray(rec:any, take:number,label:'hour'|'day'|'week') {
      return Object.entries(rec).map(([k,v]:any)=>({[label]:+k,count:v.count}))
        .sort((a:any,b:any)=>b.count-a.count).slice(0,take);
    }
    function toTimeData(rec:any,label:'hour'|'day'|'week') {
      return Object.entries(rec).map(([k,v]:any)=>({[label]:+k,count:v.count,averageWatchTime:v.totalDuration/v.count,topCategories:[]}));
    }
    function startSession(v:any,dur:number,cat:string){
      return { startTime:v.time,endTime:v.time,videoCount:1,totalDuration:dur,videos:[v],categoryDistribution:{[cat]:1} };
    }
    function extendSession(s:any,v:any,dur:number,cat:string){
      s.endTime=v.time; s.videoCount++; s.totalDuration+=dur; s.videos.push(v); s.categoryDistribution[cat]=(s.categoryDistribution[cat]??0)+1;
    }
    function parseDuration(iso:string){
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if(!m) return 0;
      return (+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0);
    }
  }
  
  export function analyzeContentPreferences(videos:any[]): any {
    const categoryStats: Record<string,{time:number;count:number}> = {};
    const channelStats:  Record<string,{time:number;count:number}> = {};
    const daily = Array(24).fill(0); const weekly=Array(7).fill(0); const monthly=Array(4).fill(0);
    for (const v of videos) {
      const dur = parseDuration(v.duration); const d = new Date(v.time); const h=d.getHours(); const wday=d.getDay(); const wk=Math.floor(d.getDate()/7);
      const cat=v.category||'Unknown'; const ch=v.channelTitle||'Unknown';
      (categoryStats[cat] ??= {time:0,count:0}).time+=dur; categoryStats[cat].count++;
      (channelStats[ch]  ??= {time:0,count:0}).time+=dur; channelStats[ch].count++;
      daily[h]++; weekly[wday]++; monthly[wk]++;
    }
    const toPref=(obj:any,extra='category|channel')=>Object.entries(obj).map(([k,{time,count}]:any)=>({
      [extra.split('|')[0]]:k, watchTime:time, videoCount:count, averageDuration:time/count, peakHours:[], topChannels:[], topCategories:[]
    }));
    return {
      preferredCategories: toPref(categoryStats,'category'),
      channelPreferences:  toPref(channelStats,'channel'),
      timeDistribution:{
        daily:  daily.map((c,h)=>({hour:h,count:c,averageWatchTime:0})),
        weekly: weekly.map((c,d)=>({day:d,count:c,averageWatchTime:0})),
        monthly:monthly.map((c,w)=>({week:w,count:c,averageWatchTime:0})),
      }
    };
    function parseDuration(iso:string){ const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if(!m) return 0; return (+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0); }
  }
  