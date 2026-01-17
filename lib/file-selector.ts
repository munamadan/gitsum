import { FileWithContent, GitHubTreeItem } from './github';

export interface FileScore {
  file: GitHubTreeItem;
  score: number;
  estimatedTokens: number;
}

function isBinaryFile(path: string, size?: number): boolean {
  const binaryExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
    '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
    '.exe', '.dll', '.so', '.dylib',
    '.class', '.jar', '.war',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
    '.woff', '.woff2', '.ttf', '.eot',
    '.bin', '.dat',
    '.pyc', '.pyo',
    '.node',
    '.db', '.sqlite',
  ];

  const ext = path.toLowerCase().split('.').pop();
  if (ext && binaryExtensions.includes(`.${ext}`)) {
    return true;
  }

  if (size && size > 1024 * 1024) {
    return true;
  }

  return false;
}

function isMinifiedFile(path: string): boolean {
  const minifiedPatterns = [
    '.min.js',
    '.min.css',
    '.bundle.js',
    '.bundle.css',
    '.chunk.js',
  ];

  return minifiedPatterns.some((pattern) => path.includes(pattern));
}

function isConfigFile(path: string): boolean {
  const configFiles = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'requirements.txt',
    'setup.py',
    'pyproject.toml',
    'Pipfile',
    'Cargo.toml',
    'go.mod',
    'go.sum',
    'pom.xml',
    'build.gradle',
    'Gemfile',
    'composer.json',
    'dockerfile',
    'docker-compose.yml',
    '.env.example',
    'tsconfig.json',
    '.eslintrc',
    '.prettierrc',
    'next.config.js',
    'vite.config.js',
    'webpack.config.js',
    'rollup.config.js',
    'tailwind.config.js',
  ];

  const lowerPath = path.toLowerCase();
  return configFiles.some((file) => lowerPath.endsWith(file) || lowerPath.endsWith(`/${file}`));
}

function isDocumentationFile(path: string): boolean {
  const docPatterns = ['readme', 'contributing', 'changelog', 'license', 'docs/', 'doc/'];
  const lowerPath = path.toLowerCase();
  return docPatterns.some((pattern) => lowerPath.includes(pattern));
}

function isEntryPoint(path: string): boolean {
  const entryPoints = [
    'index.js',
    'index.ts',
    'index.tsx',
    'index.jsx',
    'main.js',
    'main.ts',
    'main.py',
    'main.go',
    'app.js',
    'app.ts',
    'app.tsx',
    'server.js',
    'server.ts',
  ];

  const lowerPath = path.toLowerCase().split('/').pop() || '';
  return entryPoints.includes(lowerPath);
}

function isSourceFile(path: string): boolean {
  const sourceExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.py', '.rb', '.go', '.java', '.kt', '.scala',
    '.c', '.cpp', '.h', '.hpp', '.cs',
    '.php', '.swift', '.rs',
    '.vue', '.svelte',
  ];

  const ext = path.toLowerCase().split('.').pop();
  return ext ? sourceExtensions.includes(`.${ext}`) : false;
}

function isRootFile(path: string): boolean {
  return path.split('/').length === 1;
}

function estimateTokens(contentLength: number): number {
  return Math.ceil(contentLength / 3.5);
}

export function selectFiles(
  tree: GitHubTreeItem[],
  maxTokens: number = 950000
): GitHubTreeItem[] {
  const scoredFiles: FileScore[] = [];

  for (const file of tree) {
    if (!file.size) continue;

    if (isBinaryFile(file.path, file.size)) {
      continue;
    }

    if (isMinifiedFile(file.path)) {
      continue;
    }

    const depth = file.path.split('/').length - 1;
    const sizeKB = file.size / 1024;

    let score = 0;

    if (isRootFile(file.path)) {
      score += 100;
    }

    if (isEntryPoint(file.path)) {
      score += 90;
    }

    if (isConfigFile(file.path)) {
      score += 80;
    }

    if (isDocumentationFile(file.path)) {
      score += 70;
    }

    if (isSourceFile(file.path)) {
      score += 60;
    }

    score -= depth * 10;

    score -= Math.log10(Math.max(sizeKB, 1)) * 5;

    const estimatedTokens = estimateTokens(file.size);

    scoredFiles.push({
      file,
      score,
      estimatedTokens,
    });
  }

  scoredFiles.sort((a, b) => b.score - a.score);

  const selectedFiles: GitHubTreeItem[] = [];
  let currentTokens = 0;

  for (const scoredFile of scoredFiles) {
    if (currentTokens + scoredFile.estimatedTokens > maxTokens) {
      continue;
    }

    selectedFiles.push(scoredFile.file);
    currentTokens += scoredFile.estimatedTokens;
  }

  return selectedFiles;
}
