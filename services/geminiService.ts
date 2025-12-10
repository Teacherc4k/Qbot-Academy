import { GoogleGenAI, Type } from "@google/genai";
import { LevelData } from "../types";

export const generateLevel = async (prompt: string): Promise<LevelData | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Schema for strict JSON output
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "A creative name for the level" },
        description: { type: Type.STRING, description: "Short hint or description" },
        grid: {
          type: Type.ARRAY,
          description: "2D array representing the map. 0=Empty(Void), 1=Path, 2=Start, 3=Goal. The path must be contiguous.",
          items: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER }
          }
        },
        startDir: { type: Type.INTEGER, description: "0: North, 1: East, 2: South, 3: West" },
        par: { type: Type.INTEGER, description: "Expected number of blocks to solve" }
      },
      required: ["name", "description", "grid", "startDir", "par"]
    };

    const systemInstruction = `
      You are a level designer for a block-coding game "Cubebot".
      The grid represents a 3D world.
      0 is a hole/void (death).
      1 is a walkable platform.
      2 is the start position (must be on a platform).
      3 is the goal position (must be on a platform).
      Ensure the path from 2 to 3 is solvable using Move, Turn Left, Turn Right, and Jump (jump spans 1 gap of 0s).
      The grid size should be between 5x5 and 10x10.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a level with this request: ${prompt}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema as any, // Cast to any to avoid minor type mismatches with Schema definition
        temperature: 1, // Creativity allowed
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        ...data,
        id: `gen-${Date.now()}`
      };
    }
    return null;

  } catch (error) {
    console.error("Gemini Level Gen Error:", error);
    throw error;
  }
};