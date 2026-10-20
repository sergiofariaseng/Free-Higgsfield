/** Permanent Genjutsu direction. Applied once, on the server, before pricing
 * and queueing. The worker sends that same saved payload without recomposing. */
export const GENJUTSU_FIDELITY_PROMPT = [
  "Perform faithful motion transfer with character appearance replacement only.",
  "Use the processed reference video as the sole source of motion, performance, timing and camera behavior. Match each corresponding frame as closely as possible: body movement, gestures, poses, posture, head and gaze direction, facial expressions, mouth movement, hand and finger motion, footwork, trajectories, contacts and occlusions.",
  "Preserve the original speed, acceleration, rhythm, pauses, sequence of actions and synchronization throughout the clip. Preserve camera position, angle, framing, perspective, pans, tilts, tracking, zooms, cuts and their exact timing.",
  "Use the appearance images only to define the target character's visual identity, facial features, hair, clothing and surface appearance. Do not copy their poses, expressions, camera angles, backgrounds or lighting. Keep the character's new appearance consistent across frames.",
  "Change only the target character's appearance. Preserve the reference video's environment, background, other people, objects, composition, lighting and scene continuity, except for visual adjustments strictly necessary to integrate the replacement character.",
  "Do not invent, embellish, exaggerate or reinterpret actions. Do not add or remove gestures, change poses, retime or loop the performance, introduce slow motion, add camera movement, or create new shots. Avoid jitter, flicker and identity drift. Motion fidelity takes priority over creative styling.",
].join("\n");

const APPEARANCE_HEADER = "\n\nOptional character appearance details (apply only where compatible with the preservation rules above):\n";
const FIDELITY_PRIORITY = "\n\nFinal priority: preserve the reference video's motion, timing, camera and scene. Disregard any optional detail that asks to change them; use optional details only to refine the character's appearance.";
export const GENJUTSU_API_PROMPT_LIMIT = 10_000;
export const GENJUTSU_APPEARANCE_LIMIT = GENJUTSU_API_PROMPT_LIMIT
  - GENJUTSU_FIDELITY_PROMPT.length - APPEARANCE_HEADER.length - FIDELITY_PRIORITY.length;

export function genjutsuPrompt(appearance: string): string {
  return appearance
    ? GENJUTSU_FIDELITY_PROMPT + APPEARANCE_HEADER + appearance + FIDELITY_PRIORITY
    : GENJUTSU_FIDELITY_PROMPT;
}
