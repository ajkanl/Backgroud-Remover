
import { GoogleGenAI } from "@google/genai";

/**
 * Calls the Gemini API to remove the background from an image.
 * @param imageBase64 The base64 encoded image string (without the data URL prefix).
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @returns The base64 encoded string of the background-removed image.
 */
export const removeBackground = async (imageBase64: string, mimeType: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  // Create a new instance to ensure we use the correct configuration at call time
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          {
            text: 'Remove the background of this image. Output only the edited image with a transparent background. Do not include any text, headers, or explanations in your response.',
          },
        ],
      },
    });

    // Find the part containing the image data
    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePart && imagePart.inlineData) {
      return imagePart.inlineData.data;
    } else {
      // If no image is returned, look for a text error message from the model
      const textPart = response.candidates?.[0]?.content?.parts?.find(part => part.text);
      const errorMessage = textPart?.text || "The AI could not process the image. Please try a different one.";
      throw new Error(`Failed to extract image from AI response: ${errorMessage}`);
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`An error occurred while communicating with the AI: ${error.message}`);
    }
    throw new Error("An unknown error occurred while removing the background.");
  }
};

/**
 * Calls the Gemini API to generate an image from a text prompt.
 * @param prompt The text prompt to generate an image from.
 * @returns The base64 encoded string of the generated image.
 */
export const generateBackground = async (prompt: string): Promise<string> => {
  if (!prompt.trim()) {
    throw new Error("Prompt cannot be empty.");
  }

  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: `A professional, high-quality, realistic background for a photo subject. Theme: ${prompt}. The composition should be clean and suitable for placing a person or object in the foreground.`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    const image = response.generatedImages?.[0]?.image?.imageBytes;

    if (image) {
      return image;
    } else {
      throw new Error("The AI could not generate an image for that prompt. Please try a different one.");
    }
  } catch (error) {
    console.error("Error calling Gemini API for image generation:", error);
    if (error instanceof Error) {
      throw new Error(`An error occurred while communicating with the AI: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the background.");
  }
};
