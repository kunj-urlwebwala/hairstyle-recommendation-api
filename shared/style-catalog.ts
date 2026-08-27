import type { HairstyleRecommendation } from "./consultation";

/**
 * Curated salon catalogue shown in the style library. Each prompt is
 * hairstyle-only and pairs with the identity-preserving try-on guardrails.
 */
export const styleCatalog: HairstyleRecommendation[] = [
  {
    id: "classic-layered-cut",
    name: "Classic layered cut",
    description: "Mid-length layers that build soft volume from the jaw down.",
    whyItWorks:
      "Layering removes weight without losing length, so hair moves naturally.",
    maintenance: "Medium",
    texture: "Natural movement",
    tone: "Everyday classic",
    prompt:
      "Give the person a classic mid-length layered haircut with soft face-framing layers, natural volume, and a smooth everyday finish.",
  },
  {
    id: "blunt-collarbone-bob",
    name: "Blunt collarbone bob",
    description: "A sharp, one-length cut ending exactly at the collarbone.",
    whyItWorks:
      "The clean line reads polished while still feeling modern and light.",
    maintenance: "Medium",
    texture: "Smooth finish",
    tone: "Minimal chic",
    prompt:
      "Give the person a blunt one-length collarbone-grazing bob with a sleek glossy finish and a subtle center part.",
  },
  {
    id: "curtain-fringe-waves",
    name: "Curtain fringe waves",
    description: "Loose waves with a wispy fringe that opens at the brow.",
    whyItWorks:
      "The open fringe softens the frame while waves keep it effortless.",
    maintenance: "Medium",
    texture: "Soft waves",
    tone: "Romantic",
    prompt:
      "Give the person long loose natural waves with a wispy curtain fringe parting softly at the brow, airy volume, and a romantic finish.",
  },
  {
    id: "bridal-low-bun",
    name: "Bridal low bun",
    description: "A polished twisted bun set low at the nape.",
    whyItWorks:
      "An elegant updo keeps attention on the outfit and jewellery-free hair drape.",
    maintenance: "Low",
    texture: "Sleek updo",
    tone: "Wedding",
    prompt:
      "Give the person an elegant low bridal bun with softly smoothed sides, gentle twist detail, and a few natural face-framing strands left loose.",
  },
  {
    id: "braided-crown-updo",
    name: "Braided crown updo",
    description: "A soft braid wrapped around the crown into a gathered updo.",
    whyItWorks:
      "Braids hold shape through long celebrations without heat styling.",
    maintenance: "Medium",
    texture: "Braid detail",
    tone: "Festive",
    prompt:
      "Give the person a soft braid following the hairline like a crown, gathering into a relaxed low updo with natural texture kept believable.",
  },
  {
    id: "long-soft-layers",
    name: "Long soft layers",
    description: "Waist-length hair with invisible layers for movement.",
    whyItWorks:
      "Long layers keep density at the ends from looking heavy or flat.",
    maintenance: "Low",
    texture: "Flowing length",
    tone: "Traditional graceful",
    prompt:
      "Give the person long flowing hair with subtle invisible layers starting below the chin, preserving fullness and adding gentle inward movement.",
  },
  {
    id: "textured-pixie",
    name: "Textured pixie",
    description: "A short crop with piecey definition on top.",
    whyItWorks:
      "Short cuts highlight bone structure and dry quickly in humid weather.",
    maintenance: "High",
    texture: "Piecey crop",
    tone: "Confident minimal",
    prompt:
      "Give the person a refined textured pixie with cropped sides, a longer piecey crown, and soft side-swept movement.",
  },
  {
    id: "shoulder-feather-cut",
    name: "Shoulder feather cut",
    description:
      "Feathered ends flicked away from the face at shoulder length.",
    whyItWorks:
      "Feathering adds bounce around the cheekbones without heavy styling.",
    maintenance: "Medium",
    texture: "Feathered ends",
    tone: "Retro fresh",
    prompt:
      "Give the person a shoulder-length feather cut with soft flicked-away ends, airy layering, and natural bounce.",
  },
  {
    id: "deep-side-part-glam",
    name: "Deep side-part glam",
    description: "Glossy waves swept into a dramatic deep side part.",
    whyItWorks:
      "A deep part instantly reads occasion-ready with minimal upkeep.",
    maintenance: "High",
    texture: "Hollywood waves",
    tone: "Evening glam",
    prompt:
      "Give the person glossy Hollywood-style waves combed into a deep side part, with polished shine and soft defined S-waves.",
  },
  {
    id: "shaggy-mid-length",
    name: "Shaggy mid-length",
    description: "A relaxed shag with curtain layers and airy texture.",
    whyItWorks:
      "The shag's lived-in layers suit low-effort, air-dried routines.",
    maintenance: "Low",
    texture: "Airy shag",
    tone: "Casual cool",
    prompt:
      "Give the person a mid-length shag haircut with airy curtain layers, light fringe, and easy undone texture.",
  },
  {
    id: "half-up-festive-twist",
    name: "Half-up festive twist",
    description: "Front sections twisted back into a half-up style.",
    whyItWorks: "Half-up styles keep hair manageable while showing off length.",
    maintenance: "Low",
    texture: "Twist detail",
    tone: "Festive easy",
    prompt:
      "Give the person a half-up hairstyle with the front sections softly twisted and pinned back, leaving the rest flowing naturally.",
  },
  {
    id: "short-professional-crop",
    name: "Short professional crop",
    description: "A neat ear-length crop with a tidy outline.",
    whyItWorks:
      "Crisp edges stay office-appropriate through long working days.",
    maintenance: "Medium",
    texture: "Neat finish",
    tone: "Professional",
    prompt:
      "Give the person a neat short professional crop just below the ear with a tidy outline, soft natural volume, and no product-heavy shine.",
  },
];

export function findCatalogStyle(
  id: string,
): HairstyleRecommendation | undefined {
  return styleCatalog.find((style) => style.id === id);
}
