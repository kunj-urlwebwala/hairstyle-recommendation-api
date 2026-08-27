export type HairstyleRecommendation = {
  id: string;
  name: string;
  description: string;
  whyItWorks: string;
  maintenance: "Low" | "Medium" | "High";
  texture: string;
  tone: string;
  prompt: string;
};

export type StyleAnalysis = {
  faceShape: string;
  overview: string;
  featureNotes: string[];
  stylePrinciples: string[];
  confidenceNote: string;
};

export type PortraitCheck = {
  status: "ready" | "retake";
  message: string;
};

export type ConsultationResponse = {
  sourceImageUrl: string;
  portraitCheck: PortraitCheck;
  analysis: StyleAnalysis;
  recommendations: HairstyleRecommendation[];
};

export const fallbackStyleAnalysis: StyleAnalysis = {
  faceShape: "Style profile ready",
  overview:
    "Your portrait is ready for a flexible set of framing and movement-focused hairstyle directions. Each option below is designed as an aesthetic starting point for a conversation with your stylist.",
  featureNotes: [
    "Choose a shape that frames your features rather than hiding them.",
    "Keep the parting adaptable so it can be adjusted in the chair.",
    "Use soft movement to make the style feel personal and wearable.",
  ],
  stylePrinciples: [
    "Balance face-framing pieces with your preferred maintenance routine.",
    "Select a finish that works with your natural texture before heat styling.",
    "Bring the preview to your appointment and tailor the details with your stylist.",
  ],
  confidenceNote:
    "This profile is visual inspiration from one portrait, not a promise of an identical salon result.",
};

export const fallbackPortraitCheck: PortraitCheck = {
  status: "ready",
  message: "Your portrait is framed well enough to begin the consultation.",
};

export const fallbackRecommendations: HairstyleRecommendation[] = [
  {
    id: "soft-layered-lob",
    name: "Soft layered lob",
    description:
      "A collarbone-length cut with subtle interior layers and a relaxed center part.",
    whyItWorks:
      "The soft perimeter keeps the outline polished while face-framing layers add movement.",
    maintenance: "Medium",
    texture: "Natural movement",
    tone: "Editorial classic",
    prompt:
      "Give the person a collarbone-length soft layered lob with a relaxed center part, subtle face-framing layers, natural movement, and a polished editorial finish.",
  },
  {
    id: "curtain-fringe-waves",
    name: "Curtain fringe waves",
    description:
      "Long, loose waves with a wispy curtain fringe that opens softly at the brow.",
    whyItWorks:
      "The open fringe creates a light frame while the waves bring an easy, romantic finish.",
    maintenance: "Medium",
    texture: "Soft waves",
    tone: "Modern romantic",
    prompt:
      "Give the person long loose natural waves with a wispy curtain fringe that parts softly at the brow, with airy volume and a modern romantic finish.",
  },
  {
    id: "textured-pixie",
    name: "Textured pixie",
    description:
      "A refined short crop with a longer textured top and gentle side-swept movement.",
    whyItWorks:
      "The cropped sides focus attention upward while the longer crown leaves room for styling versatility.",
    maintenance: "High",
    texture: "Piecey texture",
    tone: "Confident minimal",
    prompt:
      "Give the person a refined textured pixie haircut with neat cropped sides, a softly longer crown, gentle side-swept movement, and natural piecey texture.",
  },
  {
    id: "sleek-italian-bob",
    name: "Sleek Italian bob",
    description:
      "A chin-skimming, softly rounded bob with a deep side part and glossy finish.",
    whyItWorks:
      "The precise outline feels intentional, while the soft bend at the ends prevents the look from becoming severe.",
    maintenance: "Medium",
    texture: "Smooth finish",
    tone: "Polished statement",
    prompt:
      "Give the person a chin-skimming Italian bob with a deep side part, softly rounded ends, light natural volume, and a healthy glossy finish.",
  },
];

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
  return items.length > 0 ? items.slice(0, 4) : fallback;
}

function asMaintenance(value: unknown): HairstyleRecommendation["maintenance"] {
  return value === "Low" || value === "High" ? value : "Medium";
}

function normalizeRecommendation(
  value: unknown,
  index: number,
): HairstyleRecommendation {
  const fallback =
    fallbackRecommendations[index % fallbackRecommendations.length];
  const raw =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const safeId = asText(raw.id, fallback.id)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  return {
    id: safeId || fallback.id,
    name: asText(raw.name, fallback.name).slice(0, 56),
    description: asText(raw.description, fallback.description).slice(0, 220),
    whyItWorks: asText(raw.whyItWorks, fallback.whyItWorks).slice(0, 240),
    maintenance: asMaintenance(raw.maintenance),
    texture: asText(raw.texture, fallback.texture).slice(0, 48),
    tone: asText(raw.tone, fallback.tone).slice(0, 48),
    prompt: asText(raw.prompt, fallback.prompt).slice(0, 900),
  };
}

export function parseStyleAnalysis(
  content: string,
): Omit<ConsultationResponse, "sourceImageUrl"> {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const analysisCandidate =
    typeof parsed.analysis === "object" && parsed.analysis !== null
      ? (parsed.analysis as Record<string, unknown>)
      : {};
  const portraitCandidate =
    typeof parsed.portraitCheck === "object" && parsed.portraitCheck !== null
      ? (parsed.portraitCheck as Record<string, unknown>)
      : {};
  const recommendationsCandidate = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
    : [];
  return {
    portraitCheck: {
      status: portraitCandidate.status === "retake" ? "retake" : "ready",
      message: asText(
        portraitCandidate.message,
        fallbackPortraitCheck.message,
      ).slice(0, 220),
    },
    analysis: {
      faceShape: asText(
        analysisCandidate.faceShape,
        fallbackStyleAnalysis.faceShape,
      ).slice(0, 48),
      overview: asText(
        analysisCandidate.overview,
        fallbackStyleAnalysis.overview,
      ).slice(0, 420),
      featureNotes: asStringArray(
        analysisCandidate.featureNotes,
        fallbackStyleAnalysis.featureNotes,
      ),
      stylePrinciples: asStringArray(
        analysisCandidate.stylePrinciples,
        fallbackStyleAnalysis.stylePrinciples,
      ),
      confidenceNote: asText(
        analysisCandidate.confidenceNote,
        fallbackStyleAnalysis.confidenceNote,
      ).slice(0, 220),
    },
    recommendations:
      recommendationsCandidate.length >= 3
        ? recommendationsCandidate.slice(0, 4).map(normalizeRecommendation)
        : fallbackRecommendations,
  };
}
