import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export const getGeminiClient = () => {
  if (!apiKey) {
    console.error("Gemini API Key is not configured in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const GEMINI_MODEL = "gemini-3-flash-preview";
