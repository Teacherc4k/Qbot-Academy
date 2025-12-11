import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { LevelData } from "../types";

// Create a single client instance
const genAI = new GoogleGenerativeAI(process.env.API_KEY as string);

export const generateLevel = async (
  prompt: string
): Promise<LevelData | null> => {
  try {
    // Schema for strict JSON output
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "A creative name for the level" },
        description: { type: SchemaType.STRING, description: "Short hint or description" },
        grid: {
          type: SchemaType.ARRAY,
          description:
            "2D array representing the map. 0=Empty(Void), 1=Path, 2=Start, 3=Goal. The path must be contiguous.",
          items: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.INTEGER }
          }
        },
        startDir: {
          type: SchemaType.INTEGER,
          description: "0: North, 1: East, 2: South, 3: West"
        },
        par: {
          type: SchemaType.INTEGER,
          description: "Expected number of blocks to solve"
        }
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

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 1
      }
    });

    const result = await model.generateContent(
      `${systemInstruction}\n\nGenerate a level with this request: ${prompt}`
    );

    const text = result.response.text();
    if (!text) {
      return null;
    }

    const data = JSON.parse(text);

    return {
      ...data,
      id: `gen-${Date.now()}`
    } as LevelData;
  } catch (error) {
    console.error("Gemini Level Gen Error:", error);
    throw error;
  }
};
