/**
 * Virtual try-on image generation.
 *
 * Supports two providers behind one call:
 * - Gemini image models (model names starting with "gemini") via the
 *   Generative Language REST API using GEMINI_API_KEY.
 * - OpenAI image models (e.g. gpt-image-1) via the Images API using OPENAI_API_KEY.
 */
import { ENV } from "./env";
import { storagePut } from "../storage";

export type SourceImage = {
  url?: string;
  b64Json?: string;
  mimeType?: string;
};

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: SourceImage[];
  /** Provider model id, e.g. "gemini-2.5-flash-image" or "gpt-image-1". */
  model?: string | null;
  /** Generation quality for providers that support it, e.g. "medium" | "high". */
  quality?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

async function readImage(
  image: SourceImage,
): Promise<{ data: Buffer; mimeType: string }> {
  const mimeType = image.mimeType ?? "image/jpeg";

  if (image.b64Json) {
    return { data: Buffer.from(image.b64Json, "base64"), mimeType };
  }

  if (!image.url)
    throw new Error("Source image has neither a URL nor inline data");

  const response = await fetch(image.url);
  if (!response.ok) {
    throw new Error(`Failed to download source image (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return { data: Buffer.from(arrayBuffer), mimeType };
}

async function generateWithGemini(
  options: GenerateImageOptions,
): Promise<Buffer> {
  if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");

  const parts: Record<string, unknown>[] = [{ text: options.prompt }];
  for (const image of options.originalImages ?? []) {
    const { data, mimeType } = await readImage(image);
    parts.push({
      inline_data: { mime_type: mimeType, data: data.toString("base64") },
    });
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
  };

  // Image-only preview models return raw image bytes when restricted to IMAGE modality.
  if (!options.model?.includes("flash-image")) {
    body.generationConfig = { responseModalities: ["IMAGE"] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": ENV.geminiApiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Gemini image request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }

  const result = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string };
          inline_data?: { data?: string };
        }>;
      };
    }>;
  };

  const imagePart = result.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data ?? part.inline_data?.data,
  );
  const base64 = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;

  if (!base64) throw new Error("The Gemini provider returned no image data");
  return Buffer.from(base64, "base64");
}

async function generateWithOpenAI(
  options: GenerateImageOptions,
): Promise<Buffer> {
  if (!ENV.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const headers = { authorization: `Bearer ${ENV.openAiApiKey}` };
  let response: Response;

  if (options.originalImages && options.originalImages.length > 0) {
    // Editing an existing portrait requires the multipart edits endpoint.
    const form = new FormData();
    form.append("model", options.model ?? "gpt-image-1");
    form.append("prompt", options.prompt);
    if (options.quality) form.append("quality", options.quality);

    for (const [index, image] of options.originalImages.entries()) {
      const { data, mimeType } = await readImage(image);
      form.append(
        "image[]",
        new Blob([new Uint8Array(data)], { type: mimeType }),
        `source-${index}.png`,
      );
    }

    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers,
      body: form,
    });
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        model: options.model ?? "gpt-image-1",
        prompt: options.prompt,
        ...(options.quality ? { quality: options.quality } : {}),
      }),
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI image request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }

  const result = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const base64 = result.data?.[0]?.b64_json;
  if (!base64) throw new Error("The OpenAI provider returned no image data");
  return Buffer.from(base64, "base64");
}

export async function generateImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResponse> {
  const model = options.model || ENV.tryOnPrimaryImageModel;
  const isGemini = model.startsWith("gemini");

  const buffer = isGemini
    ? await generateWithGemini({ ...options, model })
    : await generateWithOpenAI({ ...options, model });

  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png",
  );
  return { url };
}
