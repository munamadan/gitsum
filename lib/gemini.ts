import { Redis } from '@upstash/redis';
import { FileWithContent } from './github';

export interface AnalysisResult {
  projectOverview: string;
  prerequisites: string[];
  setupSteps: string[];
  runningInstructions: string;
  configuration: string;
  troubleshooting: string;
  osSpecificNotes?: string;
}

const redis = Redis.fromEnv();

const GEMINI_MODELS = [
  'gemini-3.0-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
];

const MODEL_CACHE_TTL = 24 * 60 * 60;

async function getCachedModel(apiKey: string): Promise<string | null> {
  try {
    const cacheKey = `gemini:working-model:${apiKey}`;
    const model = await redis.get<string>(cacheKey);
    return model;
  } catch (error) {
    console.warn('Failed to get cached model:', error);
    return null;
  }
}

async function setCachedModel(apiKey: string, model: string): Promise<void> {
  try {
    const cacheKey = `gemini:working-model:${apiKey}`;
    await redis.set(cacheKey, model, { ex: MODEL_CACHE_TTL });
  } catch (error) {
    console.warn('Failed to set cached model:', error);
  }
}

async function invalidateModelCache(apiKey: string): Promise<void> {
  try {
    const cacheKey = `gemini:working-model:${apiKey}`;
    await redis.del(cacheKey);
  } catch (error) {
    console.warn('Failed to invalidate model cache:', error);
  }
}

interface GeminiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

function isModelNotFoundError(error: any): boolean {
  const errorMsg = error?.message || error?.toString() || '';
  const geminiError = error as GeminiError;
  
  const errorPatterns = [
    'Model not found',
    'model not found',
    'Model does not exist',
    'invalid model',
    'does not support this model',
  ];
  
  if (geminiError?.error?.code === 404) {
    return true;
  }
  
  return errorPatterns.some(pattern => errorMsg.toLowerCase().includes(pattern));
}

function isInvalidApiKeyError(error: any): boolean {
  const errorMsg = error?.message || error?.toString() || '';
  const geminiError = error as GeminiError;
  
  if (geminiError?.error?.code === 403 || geminiError?.error?.code === 401) {
    const message = errorMsg.toLowerCase();
    return message.includes('api key') || 
           message.includes('authentication') ||
           message.includes('unauthorized');
  }
  
  return false;
}

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || error?.toString() || '';
  const geminiError = error as GeminiError;
  
  if (geminiError?.error?.code === 429) {
    return true;
  }
  
  return errorMsg.toLowerCase().includes('quota') ||
         errorMsg.toLowerCase().includes('rate limit') ||
         errorMsg.toLowerCase().includes('resource exhausted');
}

function isTemporaryError(error: any): boolean {
  const errorMsg = error?.message || error?.toString() || '';
  const geminiError = error as GeminiError;
  
  if (geminiError?.error?.code >= 500) {
    return true;
  }
  
  const temporaryPatterns = [
    'timeout',
    'deadline exceeded',
    'service unavailable',
    'try again later',
  ];
  
  return temporaryPatterns.some(pattern => errorMsg.toLowerCase().includes(pattern));
}

async function callGeminiAPI(
  prompt: string, 
  apiKey: string, 
  model?: string, 
  maxRetries = 3
): Promise<{ text: string; model: string }> {
  const requestId = `gemini-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  let modelsToTry = model ? [model] : GEMINI_MODELS;
  
  if (model && !modelsToTry.includes(model)) {
    modelsToTry = [model, ...modelsToTry];
  }
  
  const cachedModel = await getCachedModel(apiKey);
  if (cachedModel && !modelsToTry.includes(cachedModel)) {
    modelsToTry = [cachedModel, ...modelsToTry];
  }
  
  for (const currentModel of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${currentModel}:generateContent?key=${apiKey}`;
    
    console.log(`[${requestId}] === ATTEMPTING MODEL: ${currentModel} ===`);
    console.log(`[${requestId}] API URL:`, url);
    console.log(`[${requestId}] Prompt length:`, prompt.length);
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      console.log(`[${requestId}] === ATTEMPT ${attempt + 1}/${maxRetries} for ${currentModel} ===`);
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt,
              }],
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 8192,
            },
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        
        console.log(`[${requestId}] Response status:`, response.status);
        console.log(`[${requestId}] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries())));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[${requestId}] Gemini API error response:`, errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          
          const error = new Error(errorData.error?.message || errorText);
          (error as any).status = response.status;
          (error as any).geminiError = errorData;
          
          if (isInvalidApiKeyError(error)) {
            console.error(`[${requestId}] === INVALID API KEY, ABORTING ALL MODELS ===`);
            throw new Error('Invalid Gemini API key. Please check your API key and try again.');
          }
          
          if (isModelNotFoundError(error)) {
            console.warn(`[${requestId}] Model ${currentModel} not found for this API key`);
            break;
          }
          
          if (isRateLimitError(error)) {
            console.warn(`[${requestId}] Rate limit exceeded for model ${currentModel}`);
            break;
          }
          
          if (isTemporaryError(error)) {
            console.warn(`[${requestId}] Temporary error for model ${currentModel}, retrying...`);
            if (attempt < maxRetries - 1) {
              const delayMs = 2000 * (attempt + 1);
              console.log(`[${requestId}] Retrying after ${delayMs}ms delay`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              continue;
            }
            break;
          }
          
          throw error;
        }
        
        const data = await response.json();
        console.log(`[${requestId}] Response data structure:`, JSON.stringify({
          hasCandidates: !!data.candidates,
          candidatesCount: data.candidates?.length || 0,
          hasFinishReason: !!data.candidates?.[0]?.finishReason,
          finishReason: data.candidates?.[0]?.finishReason
        }));
        
        if (!data.candidates || data.candidates.length === 0) {
          console.error(`[${requestId}] No candidates in response`);
          break;
        }
        
        const finishReason = data.candidates[0].finishReason;
        if (finishReason && finishReason !== 'STOP') {
          console.warn(`[${requestId}] Finish reason not STOP: ${finishReason}`);
          
          if (finishReason === 'SAFETY') {
            console.error(`[${requestId}] Content blocked by safety filters`);
            break;
          }
          
          if (finishReason === 'RECITATION') {
            console.error(`[${requestId}] Content blocked by recitation filters`);
            break;
          }
        }
        
        const resultText = data.candidates[0].content.parts[0].text;
        
        if (!resultText || resultText.length === 0) {
          console.error(`[${requestId}] Empty response from ${currentModel}`);
          break;
        }
        
        console.log(`[${requestId}] === SUCCESS WITH MODEL: ${currentModel} ===`);
        console.log(`[${requestId}] Response text length:`, resultText.length);
        console.log(`[${requestId}] Response preview:`, resultText.substring(0, 200));
        
        await setCachedModel(apiKey, currentModel);
        
        return { text: resultText, model: currentModel };
      } catch (error) {
        console.error(`[${requestId}] Model ${currentModel} attempt ${attempt + 1} failed:`, {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error)
        });
        
        if (isInvalidApiKeyError(error)) {
          throw error;
        }
        
        if (isModelNotFoundError(error)) {
          console.warn(`[${requestId}] Model ${currentModel} not available`);
          break;
        }
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(`[${requestId}] Request timeout for ${currentModel}`);
          break;
        }
        
        if (attempt === maxRetries - 1) {
          console.error(`[${requestId}] All retries exhausted for model ${currentModel}`);
          break;
        }
        
        if (isTemporaryError(error)) {
          const delayMs = 2000 * (attempt + 1);
          console.log(`[${requestId}] Retrying after ${delayMs}ms delay`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          const delayMs = 1000 * (attempt + 1);
          console.log(`[${requestId}] Retrying after ${delayMs}ms delay`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
  }
  
  console.error(`[${requestId}] === ALL MODELS FAILED ===`);
  console.error(`[${requestId}] Tried models:`, modelsToTry.join(', '));
  await invalidateModelCache(apiKey);
  throw new Error('All Gemini models failed. This could be due to: 1) Invalid API key, 2) No available models for your key, 3) Rate limits exceeded, 4) Network issues. Please check your API key or try again later.');
}

function constructSystemPrompt(repoName: string, userOS?: string): string {
  let prompt = `You are a developer assistant analyzing a GitHub repository to create setup instructions.

Repository: ${repoName}
User OS: ${userOS || 'all platforms'}

Generate a comprehensive setup guide with these sections:

1. PROJECT OVERVIEW
   - What the project does
   - Main technologies used
   - Architecture overview

2. PREREQUISITES
   - Required languages/runtimes (with versions)
   - Required tools (git, npm, pip, etc.)
   - System requirements

3. SETUP STEPS
   - Clone/fork instructions
   - Installation commands
   - Configuration steps
   ${userOS ? `- OS-specific commands for ${userOS}` : ''}

4. RUNNING THE PROJECT
   - Development server commands
   - Build commands
   - Testing commands

5. CONFIGURATION
   - Environment variables needed
   - Config file locations
   - API keys or secrets required

6. TROUBLESHOOTING
   - Common issues
   - Platform-specific gotchas
   - Debugging tips

CRITICAL RULES:
- ONLY reference files actually provided in the context
- If unclear, say "Check [filename] for details"
- NEVER assume dependencies not in manifest files
- Format your response as a valid JSON object with these exact keys: projectOverview, prerequisites (array of strings), setupSteps (array of strings), runningInstructions, configuration, troubleshooting
- ${userOS ? `Include osSpecificNotes for ${userOS} if applicable` : ''}
- Be concise but complete`;

  return prompt;
}

function constructFilesContext(files: FileWithContent[]): string {
  return files.map((file) => {
    const header = `\n\n=== FILE: ${file.path} ===\n`;
    const content = file.content.length > 10000
      ? file.content.substring(0, 10000) + '\n... (truncated for brevity)'
      : file.content;
    return header + content;
  }).join('\n');
}

function extractJSON(text: string): any {
  console.log('=== extractJSON START ===');
  console.log('Input text type:', typeof text);
  console.log('Input text length:', text?.length);
  console.log('Input text first 300 chars:', text?.substring(0, 300));
  
  if (typeof text !== 'string') {
    console.error('❌ extractJSON received non-string:', typeof text, text);
    throw new Error('Expected string but received ' + typeof text);
  }
  
  console.log('Attempting to find JSON in text...');
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    console.error('❌ No JSON found in Gemini response');
    console.error('First 500 chars:', text.substring(0, 500));
    console.error('Full response:', text);
    throw new Error('No JSON found in Gemini response');
  }
  
  console.log('✓ JSON pattern matched:', !!jsonMatch);
  const jsonStr = jsonMatch[1] || jsonMatch[0];
  console.log('Matched JSON string length:', jsonStr?.length);
  console.log('Matched JSON first 150 chars:', jsonStr?.substring(0, 150));
  
  if (typeof jsonStr !== 'string') {
    console.error('❌ Matched JSON is not a string:', typeof jsonStr, jsonStr);
    throw new Error('Extracted JSON is not a string');
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    console.log('✓ JSON parsed successfully');
    console.log('Parsed structure:', Object.keys(parsed).join(', '));
    console.log('=== extractJSON END ===');
    return parsed;
  } catch (parseError) {
    console.error('❌ JSON parse error:', parseError);
    console.error('Failed to parse string (first 300 chars):', jsonStr.substring(0, 300));
    console.error('=== extractJSON FAILED ===');
    throw new Error('Failed to parse JSON from Gemini response: ' + (parseError instanceof Error ? parseError.message : String(parseError)));
  }
}

export async function analyzeCodebase(
  files: FileWithContent[],
  repoName: string,
  userOS?: string,
  apiKey?: string
): Promise<AnalysisResult> {
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }

  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const systemPrompt = constructSystemPrompt(repoName, userOS);
  const filesContext = constructFilesContext(files);
  const fullPrompt = systemPrompt + '\n\n=== REPOSITORY FILES ===' + filesContext;

  console.log(`Sending ${files.length} files (${fullPrompt.length} chars) to Gemini API`);

  const { text: response, model } = await callGeminiAPI(fullPrompt, apiKey);

  console.log('Received response from Gemini API');
  console.log('Model used:', model);

  try {
    const result = extractJSON(response);

    return {
      projectOverview: result.projectOverview || 'No overview provided',
      prerequisites: Array.isArray(result.prerequisites) ? result.prerequisites : [],
      setupSteps: Array.isArray(result.setupSteps) ? result.setupSteps : [],
      runningInstructions: result.runningInstructions || 'No running instructions provided',
      configuration: result.configuration || 'No configuration details provided',
      troubleshooting: result.troubleshooting || 'No troubleshooting information provided',
      osSpecificNotes: result.osSpecificNotes,
    };
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    throw new Error('Failed to parse Gemini API response. Please try again.');
  }
}
