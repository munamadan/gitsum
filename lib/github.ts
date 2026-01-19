import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubRepoMetadata {
  name: string;
  full_name: string;
  size: number;
  language: string | null;
  default_branch: string;
  private: boolean;
}

export interface FileWithContent extends GitHubTreeItem {
  content: string;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function getRepoMetadata(
  url: string,
  token?: string
): Promise<GitHubRepoMetadata> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error('Invalid GitHub URL format');
  }

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Repository not found or is private');
    }
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

export async function getRepoTree(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubTreeItem[]> {
  const cacheKey = `github:tree:${owner}:${repo}`;
  const cached = await redis.get<string>(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.truncated) {
    console.warn('Repository tree was truncated by GitHub API');
  }

  const tree = data.tree.filter((item: GitHubTreeItem) => item.type === 'blob');

  await redis.set(cacheKey, JSON.stringify(tree), { ex: 3600 });

  return tree;
}

export async function fetchFileContents(
  owner: string,
  repo: string,
  files: GitHubTreeItem[],
  token?: string
): Promise<FileWithContent[]> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const batchSize = 50;
  const results: FileWithContent[] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const promises = batch.map(async (file) => {
      try {
        const response = await fetch(file.url, { headers });

        if (!response.ok) {
          console.warn(`Failed to fetch ${file.path}: ${response.statusText}`);
          return null;
        }

        const data = await response.json();

        return {
          ...file,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
        };
      } catch (error) {
        console.warn(`Error fetching ${file.path}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter((f): f is FileWithContent => f !== null));
  }

  return results;
}
