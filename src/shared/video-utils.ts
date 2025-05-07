export function extractVideoId(url: string): string {
    if (!url) return '';
    const match = url.match(/(?:youtu\.be\/|watch\?v=|embed\/|v\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : '';
  }
  