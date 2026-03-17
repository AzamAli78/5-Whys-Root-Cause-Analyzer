import { GoogleGenAI, Type } from "@google/genai";
import { WhyStep } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateNextWhy(
  problem: string,
  previousSteps: { why: string; answer: string }[],
  customInstruction?: string
): Promise<WhyStep> {
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

  return JSON.parse(response.text);
}

export async function generateFinalAnalysis(
  problem: string,
  steps: { why: string; answer: string }[],
  customInstruction?: string
) {
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

  return JSON.parse(response.text);
}
