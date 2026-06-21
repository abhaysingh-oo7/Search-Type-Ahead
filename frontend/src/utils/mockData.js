// Deterministic pseudo-random number generator based on string hash
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return Math.abs(hash);
}

const CATEGORIES = ['Technology', 'AI', 'Entertainment', 'Sports', 'News', 'Gaming', 'Finance', 'Development'];

export function enrichSuggestion(suggestion) {
  const hash = hashString(suggestion.query);
  
  // Growth: -5% to +45%
  const dailyGrowth = ((hash % 500) / 10) - 5;
  const weeklyGrowth = dailyGrowth + ((hash % 300) / 10);
  
  // Category
  const category = CATEGORIES[hash % CATEGORIES.length];
  
  return {
    ...suggestion,
    category,
    dailyGrowth: Number(dailyGrowth.toFixed(1)),
    weeklyGrowth: Number(weeklyGrowth.toFixed(1)),
  };
}

export function generateChartData(query, currentCount) {
  const hash = hashString(query);
  const data = [];
  let baseCount = Math.max(1000, Math.floor(currentCount * 0.7)); // start at 70% of current
  
  // Generate 7 days of mock data
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // add some noise
    const noise = ((hash + i * 17) % 200) / 100 - 0.5; // -0.5 to +0.5
    let dayCount = Math.floor(baseCount * (1 + noise * 0.2));
    if (i === 0) dayCount = currentCount; // Today is current count
    
    data.push({
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      searches: dayCount,
    });
    
    baseCount = dayCount * 1.05; // slight upward trend
  }
  
  return data;
}

export function generateRelatedSearches(query) {
  const hash = hashString(query);
  const pool = [
    'Tools', 'Alternatives', 'Review', 'Tutorial', '2026', 'News', 'Update', 'Pricing', 'vs', 'Guide'
  ];
  
  const related = [];
  const count = (hash % 3) + 3; // 3 to 5 related terms
  for(let i=0; i<count; i++) {
    const suffix = pool[(hash + i * 7) % pool.length];
    related.push(`${query} ${suffix}`);
  }
  
  // Sometimes add a prefix
  if (hash % 2 === 0) {
    related.push(`Best ${query}`);
  }
  
  return related;
}
