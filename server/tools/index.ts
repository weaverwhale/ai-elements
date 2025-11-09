import { tool } from 'ai';
import { moby } from './moby';
import { urbanDictionary } from './urbanDictionary';
import { chartGenerator } from './chartGenerator';
import { forecast } from './forecast';
import { wikipedia } from './wikipedia';
import { weeklyReport } from './weeklyReport';
import { memory } from './memory';
import { generativeUi } from './generativeUI';
import { operator } from './operator';
import { webSearch } from './webSearch';
import { generateImage } from './generateImage';
import { generateVideo } from './generateVideo';
import { executor } from './executor';
import { solana } from './solana';

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  // don't care about the input schema and execute function
}

// Original tools with metadata (for API endpoints, prompts, etc.)
export const toolsMetadata: Record<string, ToolMetadata> = {
  moby,
  urbanDictionary,
  chartGenerator,
  forecast,
  wikipedia,
  weeklyReport,
  memory,
  generativeUi,
  webSearch,
  operator,
  generateImage,
  generateVideo,
  executor,
  solana,
};

// Convert tools to AI SDK format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createAISDKTool(toolDef: any) {
  return tool({
    description: toolDef.description,
    inputSchema: toolDef.inputSchema,
    execute: toolDef.execute,
  });
}

// AI SDK compatible tools
export const tools = {
  moby: createAISDKTool(moby),
  urbanDictionary: createAISDKTool(urbanDictionary),
  chartGenerator: createAISDKTool(chartGenerator),
  forecast: createAISDKTool(forecast),
  wikipedia: createAISDKTool(wikipedia),
  weeklyReport: createAISDKTool(weeklyReport),
  memory: createAISDKTool(memory),
  generativeUi: createAISDKTool(generativeUi),
  webSearch: createAISDKTool(webSearch),
  operator: createAISDKTool(operator),
  generateImage: createAISDKTool(generateImage),
  generateVideo: createAISDKTool(generateVideo),
  executor: createAISDKTool(executor),
  solana: createAISDKTool(solana),
};

export const geminiTools = {
  moby: createAISDKTool(moby),
  urbanDictionary: createAISDKTool(urbanDictionary),
  // chartGenerator,
  forecast: createAISDKTool(forecast),
  wikipedia: createAISDKTool(wikipedia),
  weeklyReport: createAISDKTool(weeklyReport),
  memory: createAISDKTool(memory),
  generativeUi: createAISDKTool(generativeUi),
  webSearch: createAISDKTool(webSearch),
  operator: createAISDKTool(operator),
  generateImage: createAISDKTool(generateImage),
  generateVideo: createAISDKTool(generateVideo),
  executor: createAISDKTool(executor),
  solana: createAISDKTool(solana),
};
