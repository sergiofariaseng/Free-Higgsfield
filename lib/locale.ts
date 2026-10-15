/** Portuguese display text only. Never use these labels in API payloads. */
const labels: Record<string, string> = {
  Audio: "Áudio", Avoid: "Evitar", CFG: "CFG", Character: "Personagem",
  Effort: "Esforço", Enhance: "Melhorar descrição", Format: "Formato",
  Length: "Duração", Likeness: "Semelhança", Optimise: "Otimizar",
  Quality: "Qualidade", Ratio: "Proporção", Render: "Renderização",
  Seed: "Semente", Strength: "Intensidade", Style: "Estilo",
};

export function paramLabel(label: string): string {
  return labels[label] ?? label;
}

const parameterNames: Record<string, string> = {
  aspect_ratio: "Proporção", resolution: "Qualidade", duration: "Duração",
  seed: "Semente", enhance_prompt: "Melhorar descrição", prompt_optimizer: "Otimizar",
  generate_audio: "Áudio", negative_prompt: "Evitar", character_id: "Personagem",
  custom_reference_strength: "Semelhança", style_strength: "Intensidade do estilo",
  cfg_scale: "CFG", num_images: "Quantidade de imagens", batch_size: "Quantidade",
  output_format: "Formato", rendering_speed: "Velocidade de renderização",
  reasoning_effort: "Esforço de raciocínio", image_url: "Imagem de referência",
  image_urls: "Imagens de referência", image_reference_url: "Imagem de referência",
  video_url: "Vídeo de referência", audio_url: "Áudio de referência", prompt: "Descrição",
};

export function parameterLabel(key: string): string {
  return parameterNames[key] ?? "Parâmetro adicional";
}

export function optionLabel(value: unknown): string {
  const options: Record<string, string> = {
    auto: "Automático", adaptive: "Adaptável", low: "Baixo", medium: "Médio", high: "Alto",
    TURBO: "Turbo", DEFAULT: "Padrão", QUALITY: "Qualidade", true: "Sim", false: "Não",
  };
  return options[String(value)] ?? (typeof value === "number" ? value.toLocaleString("pt-BR") : String(value));
}

export function kindLabel(kind: "image" | "video" | "audio"): string {
  return { image: "imagem", video: "vídeo", audio: "áudio" }[kind];
}

const descriptions: Record<string, string> = {
  "Cinematic look, and the cheapest way to draft an idea.": "Visual cinematográfico e a opção mais econômica para esboçar uma ideia.",
  "Goes up to 1600p, and takes any batch size from one to four.": "Resolução de até 1600p e lotes de uma a quatro imagens.",
  "Match the style of a reference image. Requires an attachment.": "Reproduz o estilo de uma imagem de referência. É necessário anexar uma imagem.",
  "Place a saved character in a new scene. Needs a character ID.": "Coloca um personagem salvo em uma nova cena. Requer o ID do personagem.",
  "The cheapest video on the API by a wide margin.": "A opção de vídeo mais econômica da API, com ampla diferença de preço.",
  "Quick image-to-video. Requires an attachment.": "Transforma imagens em vídeos rapidamente. É necessário anexar uma imagem.",
  "The higher-fidelity Hailuo tier.": "A versão do Hailuo com maior fidelidade.",
  "Can drop to 480p for cheap drafts.": "Permite usar 480p para criar rascunhos econômicos.",
  "Higgsfield's own camera-motion model. Needs an image.": "Modelo de movimento de câmera do Higgsfield. Requer uma imagem.",
  "Higher-quality DoP. Needs an image.": "DoP de maior qualidade. Requer uma imagem.",
  "Kling's 2.1 flagship tier.": "A versão de ponta do Kling 2.1.",
  "The Pro Hailuo 02 tier. 6s · text or image input.": "Versão Pro do Hailuo 02. 6 s · entrada de texto ou imagem.",
  "The full-quality DoP tier.": "A versão do DoP com qualidade máxima.",
  "The full-quality DoP tier. Needs an image.": "A versão do DoP com qualidade máxima. Requer uma imagem.",
  "Interpolates between two images. Attach a start then an end frame.": "Cria a transição entre duas imagens. Anexe primeiro o quadro inicial e depois o final.",
  "Edit an existing clip with a prompt. Attach an MP4.": "Edita um vídeo existente a partir de uma descrição. Anexe um MP4.",
  "Continue an existing clip. Attach an MP4.": "Dá continuidade a um vídeo existente. Anexe um MP4.",
  "Use a clip as a reference. Up to 4K.": "Usa um vídeo como referência. Resolução de até 4K.",
  "Drive a video from a sound. Attach a WAV.": "Gera um vídeo a partir de um áudio. Anexe um WAV.",
  "Use a clip as a motion reference. Attach an MP4.": "Usa um vídeo como referência de movimento. Anexe um MP4.",
  "Use a clip as a reference. Outputs 2K.": "Usa um vídeo como referência. Gera resultados em 2K.",
  "Use a clip as a reference. Attach an MP4.": "Usa um vídeo como referência. Anexe um MP4.",
  "Google's quicker Veo tier, with optional native audio.": "A versão mais rápida do Veo do Google, com áudio nativo opcional.",
  "Google's top Veo tier.": "A versão de ponta do Veo do Google.",
  "Billed per token, not per generation.": "Cobrança por token, conforme o uso.",
  "Billed per token. Re-edits a clip you attach.": "Cobrança por token. Reedita um vídeo anexado.",
  "Billed per token. Continues a clip you attach.": "Cobrança por token. Dá continuidade a um vídeo anexado.",
  "Billed per token. Goes up to 4K.": "Cobrança por token. Resolução de até 4K.",
  "Billed per token. Drives the video from an audio track.": "Cobrança por token. Gera o vídeo a partir de uma faixa de áudio.",
  "Billed per token. Outputs at 2K.": "Cobrança por token. Gera resultados em 2K.",
  "character UUID from Higgsfield": "UUID do personagem no Higgsfield",
  "blurry, distorted…": "desfocado, distorcido…",
};

/** Also covers generated catalogue descriptions after rebuilding the registry. */
export function modelText(text: string): string {
  return descriptions[text] ?? text
    .replace(/Up to /g, "Até ")
    .replace(/text or image input/g, "entrada de texto ou imagem")
    .replace(/needs an image/g, "requer uma imagem")
    .replace(/optional audio/g, "áudio opcional")
    .replace(/billed per token/g, "cobrança por token")
    .replace(/Ideogram model/g, "Modelo Ideogram");
}

/** Localize service failures at the display boundary, keeping raw diagnostics server-side. */
export function errorLabel(message: string): string {
  if (/failed to fetch|fetch failed|networkerror|load failed/i.test(message)) return "Falha de conexão. Verifique sua internet e tente novamente.";
  if (/unauthorized|invalid.*(key|credential)|authentication/i.test(message)) return "Chave de API inválida. Confira o ID e o segredo em Configurações.";
  if (/not_enough_credits|insufficient.*(credit|balance)|payment required/i.test(message)) return "Saldo insuficiente na API do Higgsfield. Confira o saldo no console do Higgsfield antes de gerar novamente.";
  if (/rate limit|too many requests|account_queue_full/i.test(message)) return "Limite de solicitações atingido. Aguarde e tente novamente.";
  if (/moderation|nsfw|content policy/i.test(message)) return "A solicitação foi bloqueada pela moderação de conteúdo.";
  if (/model_not_found/i.test(message)) return "Modelo indisponível para sua conta.";
  if (/model_blocked/i.test(message)) return "Modelo bloqueado para sua conta.";
  if (/timed? out|timeout/i.test(message)) return "O tempo de espera terminou. Tente novamente.";
  if (/not found|no such job/i.test(message)) return "Não encontrado.";
  if (/Higgsfield API key not set/i.test(message)) return "Chave de API do Higgsfield não configurada. Adicione-a em Configurações.";
  if (/[áàâãéêíóôõúç]/i.test(message) || /^(Modelo|Formato|Tempo|Limite|Bloqueado|Cancelado|Este modelo)/.test(message)) return message;
  return "Não foi possível concluir a solicitação. Confira as configurações e tente novamente.";
}
