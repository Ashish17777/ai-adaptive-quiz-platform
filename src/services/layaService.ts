/**
 * Laya Adaptive AI Service
 * Connects to Hugging Face Space running TinyLlama / Gradio inference.
 * Includes local fallback logic if the space is sleeping or cold-starting.
 */

export interface LayaAdaptRequest {
  studentScore: number; // 0.0 to 1.0
  currentDifficulty: 'easy' | 'medium' | 'hard';
  streak: number;
  topic: string;
  totalAnswered: number;
}

export interface LayaAdaptResponse {
  difficulty: 'easy' | 'medium' | 'hard';
  confidence: number;
  reasoning: string;
  source: 'laya-ai' | 'algorithmic-fallback';
}

export interface LayaHintResponse {
  hint: string;
  source: 'laya-ai' | 'fallback';
}

const HF_SPACE_URL = import.meta.env.VITE_LAYA_SPACE_URL || '';

/**
 * Request adaptive difficulty decision from Laya
 */
export async function getLayaAdaptiveDifficulty(
  params: LayaAdaptRequest
): Promise<LayaAdaptResponse> {
  const { studentScore, currentDifficulty, streak, topic, totalAnswered } = params;

  if (HF_SPACE_URL) {
    try {
      const cleanUrl = HF_SPACE_URL.replace(/\/+$/, '');
      // Gradio direct call endpoint
      const response = await fetch(`${cleanUrl}/gradio_api/call/adapt_difficulty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [studentScore, currentDifficulty, streak, topic, totalAnswered],
        }),
        signal: AbortSignal.timeout(8000), // 8s timeout
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.data && result.data[0]) {
          const raw = typeof result.data[0] === 'string' ? JSON.parse(result.data[0]) : result.data[0];
          return {
            difficulty: (raw.difficulty || currentDifficulty) as 'easy' | 'medium' | 'hard',
            confidence: Number(raw.confidence) || 0.85,
            reasoning: raw.reasoning || 'AI adaptive adjustment',
            source: 'laya-ai',
          };
        }
      }
    } catch (err) {
      console.warn('Laya AI endpoint unreachable or timed out, using fallback rules:', err);
    }
  }

  // Fallback Algorithmic Evaluation
  return getFallbackDifficulty(studentScore, currentDifficulty, streak);
}

/**
 * Request AI hint from Laya
 */
export async function getLayaHint(
  question: string,
  topic: string,
  difficulty: string
): Promise<LayaHintResponse> {
  if (HF_SPACE_URL) {
    try {
      const cleanUrl = HF_SPACE_URL.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/gradio_api/call/generate_hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [question, topic, difficulty],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.data && result.data[0]) {
          return {
            hint: String(result.data[0]),
            source: 'laya-ai',
          };
        }
      }
    } catch (err) {
      console.warn('Laya AI hint unreachable, using fallback:', err);
    }
  }

  return {
    hint: 'Consider the core concept of this topic and eliminate the least plausible choices first.',
    source: 'fallback',
  };
}

/**
 * Internal heuristic rule-based difficulty transition
 */
function getFallbackDifficulty(
  score: number,
  current: 'easy' | 'medium' | 'hard',
  streak: number
): LayaAdaptResponse {
  const levels: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];
  const idx = levels.indexOf(current);

  if (score >= 0.75 && streak >= 2) {
    const nextIdx = Math.min(idx + 1, levels.length - 1);
    return {
      difficulty: levels[nextIdx],
      confidence: 0.9,
      reasoning: `Strong performance (${Math.round(score * 100)}%) with ${streak} consecutive correct answers. Increasing challenge.`,
      source: 'algorithmic-fallback',
    };
  }

  if (score < 0.45) {
    const prevIdx = Math.max(idx - 1, 0);
    return {
      difficulty: levels[prevIdx],
      confidence: 0.85,
      reasoning: `Score (${Math.round(score * 100)}%) indicates concepts need reinforcement. Decreasing difficulty.`,
      source: 'algorithmic-fallback',
    };
  }

  return {
    difficulty: current,
    confidence: 0.8,
    reasoning: `Steady progress (${Math.round(score * 100)}%). Maintaining current difficulty level.`,
    source: 'algorithmic-fallback',
  };
}
