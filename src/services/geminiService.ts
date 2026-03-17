import { GoogleGenAI, Type } from "@google/genai";
import { WhyStep } from "../types";

export class AIError extends Error {
  constructor(public message: string, public type: 'rate-limit' | 'api-key' | 'safety' | 'server' | 'unknown') {
    super(message);
    this.name = 'AIError';
  }
}

function handleAIError(error: any): never {
  console.error("AI API Error:", error);
  
  const message = error?.message || String(error);
  
  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    throw new AIError("Rate limit exceeded. Please wait a minute before trying again.", 'rate-limit');
  }
  
  if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('api key')) {
    throw new AIError("API key issue. Please check your configuration or contact the administrator.", 'api-key');
  }
  
  if (message.toLowerCase().includes('safety') || message.includes('blocked')) {
    throw new AIError("The request was blocked by safety filters. Please try a different topic.", 'safety');
  }
  
  if (message.includes('500') || message.includes('503') || message.toLowerCase().includes('server error')) {
    throw new AIError("The AI server is temporarily unavailable. Please try again in a moment.", 'server');
  }

  throw new AIError("An unexpected error occurred while communicating with the AI.", 'unknown');
}

export async function generateNextWhy(
  problem: string,
  previousSteps: { why: string; answer: string }[],
  customInstruction?: string
): Promise<WhyStep> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";
  
  const context = previousSteps.length > 0 
    ? `Previous steps:\n${previousSteps.map((s, i) => `Why #${i + 1}: ${s.why}\nAnswer: ${s.answer}`).join('\n')}`
    : "";

  const defaultInstruction = "You are a Root Cause Analysis expert.";
  const instruction = customInstruction || defaultInstruction;

  const prompt = `${instruction}
The user's initial problem is: "${problem}"
${context}

Generate the next "Why" question in the 5 Whys sequence (this is Why #${previousSteps.length + 1}).
The question should be short, sharp, and build directly on the last answer provided.
Also provide 3 short, relevant possible answers as options.

Return the result as JSON.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "The short, sharp Why question." },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3 short possible answers."
            }
          },
          required: ["question", "options"]
        }
      }
    });

    let text = response.text;
    text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(text);
  } catch (error) {
    handleAIError(error);
  }
}

export async function generateFinalAnalysis(
  problem: string,
  steps: { why: string; answer: string }[],
  customInstruction?: string
) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";
  
  const chain = steps.map((s, i) => `Why #${i + 1}: ${s.why}\nAnswer: ${s.answer}`).join('\n');

  const defaultInstruction = "You are a Root Cause Analysis expert.";
  const instruction = customInstruction || defaultInstruction;

  const prompt = `${instruction}
Initial Problem: ${problem}
The 5 Whys Chain:
${chain}

Based on this chain, identify the root cause and provide an actionable solution.
1. Root Cause Summary: 1-2 sentence summary of the chain from problem to root cause.
2. Actionable Solution: 3-5 clear, practical steps to fix the root cause.
3. Pro Tip: One smart insight to prevent recurrence.

Return the result as JSON.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rootCause: { type: Type.STRING },
            solution: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            proTip: { type: Type.STRING }
          },
          required: ["rootCause", "solution", "proTip"]
        }
      }
    });

    let text = response.text;
    text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(text);
  } catch (error) {
    handleAIError(error);
  }
}
