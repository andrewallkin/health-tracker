import type { DescribeFoodInput, FoodEstimate } from "../types/foodEstimate";

const ESTIMATE_DELAY_MS = 900;

export async function mockEstimateFood(input: DescribeFoodInput): Promise<FoodEstimate> {
  await delay(ESTIMATE_DELAY_MS);

  const note = input.note.trim().toLowerCase();
  const hasPhoto = Boolean(input.photoUrl);

  if (note.includes("label") || note.includes("kj") || note.includes("per serving")) {
    return {
      name: "Packaged food from label",
      calories_kcal: 420,
      macros_g: { protein: 32, carbs: 38, fat: 14 },
      confidence: "high",
      source: "label",
      summary: "Read from a visible nutrition label and scaled by the quantity in your note.",
      assumptions: [],
    };
  }

  if (note.includes("sweet potato") || note.includes("chilli") || note.includes("mince")) {
    return {
      name: "Sweet potato chilli mince",
      calories_kcal: 580,
      macros_g: { protein: 42, carbs: 52, fat: 22 },
      confidence: hasPhoto ? "medium" : "low",
      source: "estimate",
      summary: "Estimated sweet potato chilli mince portion from your description and photo.",
      assumptions: [
        "One dinner bowl serving (~350 g cooked).",
        "Lean beef mince (~15% fat).",
        "Includes sweet potato and kidney beans as described.",
      ],
    };
  }

  if (note.includes("shake") || note.includes("protein")) {
    return {
      name: "Protein shake",
      calories_kcal: 210,
      macros_g: { protein: 40, carbs: 8, fat: 3 },
      confidence: "medium",
      source: "estimate",
      summary: "Estimated protein shake from note keywords.",
      assumptions: ["Single scoop whey with oat milk.", "No added nut butter."],
    };
  }

  if (hasPhoto && !note) {
    return {
      name: "Estimated meal",
      calories_kcal: 480,
      macros_g: { protein: 28, carbs: 45, fat: 18 },
      confidence: "medium",
      source: "estimate",
      summary: "Estimated from the meal photo without a written description.",
      assumptions: [
        "One standard plate serving.",
        "Includes visible carbs and a moderate fat source.",
        "Portion size inferred from plate fill.",
      ],
    };
  }

  return {
    name: note ? capitalize(note.split("\n")[0]?.trim().slice(0, 48) ?? "Estimated meal") : "Estimated meal",
    calories_kcal: 350,
    macros_g: { protein: 22, carbs: 30, fat: 12 },
    confidence: note ? "medium" : "low",
    source: "estimate",
    summary: "General meal estimate from your note and/or photo.",
    assumptions: [
      "Single serving as described.",
      "Home-cooked unless your note says otherwise.",
      "No hidden sauces or oils beyond a typical amount.",
    ],
  };
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
