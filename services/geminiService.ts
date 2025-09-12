import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you might want a more user-friendly error display,
  // but for this environment, throwing an error is appropriate.
  throw new Error("API_KEY environment variable not set. Please configure it to use the application.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Calls the Gemini API to remove the background from an image.
 * @param imageBase64 The base64 encoded image string (without the data URL prefix).
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @returns The base64 encoded string of the background-removed image.
 */
export const removeBackground = async (imageBase64: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          {
            text: 'remove the background of this image. make the background transparent so it can be used as a layer. Do not add any text or explanation in your response, only output the edited image.',
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePart && imagePart.inlineData) {
      return imagePart.inlineData.data;
    } else {
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

  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: `A high-quality, realistic background image for a photo subject. The subject will be placed in the foreground. The prompt is: "${prompt}". Create a visually appealing and well-composed background.`,
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
