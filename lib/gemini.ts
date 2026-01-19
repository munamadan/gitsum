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

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent';

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

async function callGeminiAPI(prompt: string, apiKey: string, maxRetries = 3): Promise<any> {
  const requestId = `gemini-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const url = `${GEMINI_API_URL}?key=${apiKey}`;
  
  console.log(`[${requestId}] === GEMINI API CALL START ===`);
  console.log(`[${requestId}] API URL:`, GEMINI_API_URL);
  console.log(`[${requestId}] Prompt length:`, prompt.length);
  console.log(`[${requestId}] Max retries:`, maxRetries);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`[${requestId}] === ATTEMPT ${attempt + 1}/${maxRetries} ===`);
    
    try {
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
      });

      console.log(`[${requestId}] Response status:`, response.status);
      console.log(`[${requestId}] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries())));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] Gemini API error response:`, errorText);
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log(`[${requestId}] Response data structure:`, JSON.stringify({
        hasCandidates: !!data.candidates,
        candidatesCount: data.candidates?.length || 0,
        hasFinishReason: !!data.candidates?.[0]?.finishReason
      }));

      if (!data.candidates || data.candidates.length === 0) {
        console.error(`[${requestId}] No candidates in response`);
        throw new Error('No response from Gemini API');
      }

      const resultText = data.candidates[0].content.parts[0].text;
      console.log(`[${requestId}] === SUCCESS ===`);
      console.log(`[${requestId}] Response text length:`, resultText.length);
      console.log(`[${requestId}] Response preview:`, resultText.substring(0, 200));
      
      return resultText;
    } catch (error) {
      console.error(`[${requestId}] Gemini API attempt ${attempt + 1} failed:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error)
      });

      if (attempt === maxRetries - 1) {
        console.error(`[${requestId}] === ALL ATTEMPTS FAILED ===`);
        throw error;
      }

      const delayMs = 1000 * (attempt + 1);
      console.log(`[${requestId}] Retrying after ${delayMs}ms delay`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error(`[${requestId}] === ALL GEMINI API ATTEMPTS FAILED ===`);
  throw new Error('All Gemini API attempts failed');
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

  const response = await callGeminiAPI(fullPrompt, apiKey);

  console.log('Received response from Gemini API');

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
// Cache bust: Mon Jan 19 11:05:15 AM +0545 2026
