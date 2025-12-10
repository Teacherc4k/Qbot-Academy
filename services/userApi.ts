import { CodeBlock } from "../types";

// TODO: Replace this with your actual API endpoint
const API_ENDPOINT = 'https://api.your-company.com/v1/cubebot/progress';

export interface LevelResult {
  levelId: string | number;
  levelName: string;
  solution: CodeBlock[];
  timestamp: string;
}

export const saveLevelProgress = async (result: LevelResult): Promise<boolean> => {
  console.log("Saving progress to API:", API_ENDPOINT, result);

  try {
    // This is a standard POST request to your API
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer ' + localStorage.getItem('token'), // Uncomment if you use auth
      },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    // We log the error but don't stop the game, so the user can still play offline
    console.warn("Failed to save progress to User API:", error);
    return false;
  }
};