import recommendations from '@/data/recommendations.json';

export function findRecommendation(reviewText: string, orderedDishes: string[]) {
  const text = reviewText.toLowerCase();
  
  // Find matching recommendation
  const match = recommendations.recommendations.find(rec => {
    const hasKeyword = rec.keywords.some(k => text.includes(k.toLowerCase()));
    const hasDish = orderedDishes.some(dish => 
      dish.toLowerCase().includes(rec.dish.toLowerCase())
    );
    return hasKeyword && hasDish;
  });
  
  if (match) {
    return {
      action: match.action,
      category: match.category,
      priority: match.priority,
      rootCause: match.rootCause
    };
  }
  
  // Fallback: generic recommendation
  return {
    action: "Review kitchen process and conduct quality check",
    category: "general",
    priority: "medium",
    rootCause: "Quality issue detected"
  };
}