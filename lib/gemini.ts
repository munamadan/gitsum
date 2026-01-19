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

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';

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
  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error(`Gemini API attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw new Error('All Gemini API attempts failed');
}

function extractJSON(text: string): any {
  console.log('extractJSON received text type:', typeof text);
  console.log('extractJSON received text length:', text?.length);
  console.log('extractJSON first 200 chars:', text?.substring(0, 200));
  
  if (typeof text !== 'string') {
    console.error('extractJSON received non-string:', typeof text, text);
    throw new Error('Expected string but received ' + typeof text);
  }
  
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    console.error('No JSON found in Gemini response. First 500 chars:', text.substring(0, 500));
    throw new Error('No JSON found in Gemini response');
  }
  
  const jsonStr = jsonMatch[1] || jsonMatch[0];
  console.log('extractJSON matched string, length:', jsonStr?.length);
  console.log('extractJSON matched string first 100 chars:', jsonStr?.substring(0, 100));
  
  if (typeof jsonStr !== 'string') {
    console.error('Matched JSON is not a string:', typeof jsonStr, jsonStr);
    throw new Error('Extracted JSON is not a string');
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Failed to parse string:', jsonStr.substring(0, 500));
    throw new Error('Failed to parse JSON from Gemini response');
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
