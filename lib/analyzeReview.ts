import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Model choice is not cosmetic here: gemini-1.5-flash is retired, and 2.5-flash still
// appears in ListModels but 404s for new keys ("no longer available to new users").
// 3.6-flash is what this project's key is actually served, and it is multimodal, which
// the photo analysis below requires. Verify with ListModels before changing it.
// responseMimeType forces raw JSON at the API level, so the model cannot wrap the
// answer in ```json fences — without it the JSON.parse below fails often enough that
// the "could not parse" fallback becomes the normal path instead of a safety net.
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  generationConfig: { responseMimeType: "application/json" },
});

export async function analyzeReview({
  restaurantName,
  dishesOrdered,
  reviewText,
  base64ImageData,
}: {
  restaurantName: string;
  dishesOrdered: string[];
  reviewText: string;
  base64ImageData?: string;
}) {
  const prompt = `
    You are analyzing a food review submitted through a restaurant app.

    Restaurant: ${restaurantName}
    Dishes ordered this visit: ${dishesOrdered.join(", ")}
    Customer review text: "${reviewText}"
    Photo submitted: ${base64ImageData ? "yes" : "no"}

    Analyze both the review text and photo (if provided) and return JSON only,
    no markdown, no backticks, just raw JSON:
    {
      "sentiment": "positive/negative/neutral",
      "issue_category": "dish_quality/wait_time/service/portion/price/other/none",
      "specific_dish_mentioned": "dish name or null",
      "suggested_followup_options": ["option 1", "option 2", "option 3"],
      "text_evidence_strength": "strong/weak/none",
      "photo_verdict": "verified_with_photo/suspicious/rejected/no_photo",
      "photo_matches_order": true/false/null,
      "combined_evidence_strength": "verified_with_photo/strong/weak/none",
      "reward_multiplier": 1.5/1.0/0.5,
      "reason_for_multiplier": "one sentence explanation",
      "owner_summary": "one plain-English sentence for the restaurant owner"
    }

    Rules for combined_evidence_strength:
    - "verified_with_photo" if sentiment is negative AND photo_verdict is verified_with_photo
    - "strong" if sentiment is negative AND text is specific but no verified photo
    - "weak" if sentiment is vague or inferred only
    - "none" if positive or no useful signal

    Rules for reward_multiplier:
    - 1.5 if combined_evidence_strength is verified_with_photo (15% off)
    - 1.0 if strong (10% off)
    - 0.5 if weak (5% off)

    Rules for suggested_followup_options:
    - Only generate if sentiment is negative or neutral
    - Make options specific to the dishes ordered and the issue detected
    - Maximum 3 options, each under 6 words
    - Example: if review says "dry" and dish is "Ayam Percik":
      ["Ayam Percik was dry", "Rice was dry", "Both were dry"]

    For photo analysis (if photo provided):
    - Reject if: AI-generated, stock photo, screenshot, unrelated to food,
      or clearly not from this meal
    - Suspicious if: real food but cannot confirm it matches the order
    - Verified if: clearly real food photo, plausibly matches dishes ordered
  `;

  const contentParts: any[] = [];

  if (base64ImageData) {
    contentParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64ImageData
      }
    });
  }

  contentParts.push({ text: prompt });

  const result = await model.generateContent(contentParts);
  const responseText = result.response.text();

  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Gemini response was not valid JSON:", responseText);
    // Fallback: treat as weak evidence, standard reward
    return {
      sentiment: "neutral",
      issue_category: "none",
      specific_dish_mentioned: null,
      suggested_followup_options: [],
      text_evidence_strength: "weak",
      photo_verdict: "no_photo",
      photo_matches_order: null,
      combined_evidence_strength: "weak",
      reward_multiplier: 0.5,
      reason_for_multiplier: "Could not parse AI response",
      owner_summary: "Review submitted but could not be analyzed"
    };
  }
}
