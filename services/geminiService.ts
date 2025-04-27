import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export async function analyzeTokenPriceVolume(tokenAddress: string, priceVolumeHistory: { time: number, close: number, volumeUsd: number }[]): Promise<string> {
    if (!tokenAddress || !Array.isArray(priceVolumeHistory) || priceVolumeHistory.length === 0) {
        return "ERROR: Missing required token address or price/volume history.";
    }

    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });

    // Format data for the prompt
    const historyInfo = priceVolumeHistory.map((item, idx) =>
        `Period ${idx + 1}: Time: ${new Date(item.time * 1000).toISOString()}, Close: ${item.close}, VolumeUSD: ${item.volumeUsd}`
    ).join('\n');

    const prompt = `
Token Address: ${tokenAddress}

Recent Price and Volume History:
${historyInfo}

Based solely on this price and volume history, provide a concise 2-3 line verdict on the token's recent trend and trading activity. Consider price movement, volume spikes, and any notable patterns. Format your response as a direct recommendation. Use a single emoji at the start to indicate the emotion of the response (e.g., 🚀 for bullish, ⚠️ for caution, 🛑 for bearish, etc).`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
        });
        return response.text || "Analysis failed. Gemini did not return a response.";
    } catch (error) {
        console.error("Error analyzing token price/volume:", error);
        return "Analysis failed. Unable to provide recommendation due to technical error.";
    }
}