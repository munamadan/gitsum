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
  const requestId = `github-meta-${Date.now()}`;
  console.log(`[${requestId}] === GITHUB: getRepoMetadata START ===`);
  console.log(`[${requestId}] URL:`, url);
  console.log(`[${requestId}] Has token:`, !!token);
  
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    console.error(`[${requestId}] Invalid GitHub URL format:`, url);
    throw new Error('Invalid GitHub URL format');
  }

  console.log(`[${requestId}] Parsed:`, { owner: parsed.owner, repo: parsed.repo });

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`[${requestId}] Fetching from GitHub API...`);
  const response = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
    headers,
  });

  console.log(`[${requestId}] GitHub API response status:`, response.status);

  if (!response.ok) {
    if (response.status === 404) {
      console.error(`[${requestId}] Repository not found`);
      throw new Error('Repository not found or is private');
    }
    if (response.status === 403 || response.status === 401) {
      console.error(`[${requestId}] Authentication failed`);
      throw new Error('GitHub API authentication failed. Please check your token.');
    }
    console.error(`[${requestId}] GitHub API error:`, response.statusText);
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const metadata = await response.json();
  console.log(`[${requestId}] Repository metadata:`, {
    name: metadata.name,
    size: metadata.size,
    isPrivate: metadata.private,
    language: metadata.language
  });
  
  return metadata;
}

export async function getRepoTree(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubTreeItem[]> {
  const requestId = Date.now();
  const cacheKey = `github:tree:${owner}:${repo}`;
  console.log('getRepoTree: Checking cache for', owner, repo);

  const cached = await redis.get<string>(cacheKey);

  if (cached) {
    console.log('getRepoTree: Cache HIT');
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.error('Failed to parse cached GitHub tree:', error);
    }
  }

  console.log('getRepoTree: Cache MISS');
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('getRepoTree: Using GitHub token');
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers }
  );

  if (!response.ok) {
    console.error('GitHub API error:', response.status, response.statusText);
    if (response.status === 404) {
      throw new Error('Repository not found or is private');
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error('GitHub API authentication failed. Please check your token.');
    }
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('getRepoTree: Tree size:', data.tree?.length);

  if (data.truncated) {
    console.warn('Repository tree was truncated by GitHub API');
  }

  const tree = data.tree.filter((item: GitHubTreeItem) => item.type === 'blob');
  console.log('getRepoTree: Filtered to', tree.length, 'blobs');

  await redis.set(cacheKey, JSON.stringify(tree), { ex: 3600 });
  console.log('getRepoTree: Cached tree for 1 hour');

  return tree;
}
  }

  console.log(`[${requestId}] Cache MISS - fetching from GitHub API`);

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`[${requestId}] Fetching tree from GitHub API...`);
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers }
  );

  if (!response.ok) {
    console.error(`[${requestId}] GitHub API error:`, response.status, response.statusText);
    if (response.status === 404) {
      throw new Error('Repository not found or is private');
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error('GitHub API authentication failed. Please check your token.');
    }
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`[${requestId}] GitHub API response received, tree size:`, data.tree?.length);

  if (data.truncated) {
    console.warn(`[${requestId}] Repository tree was truncated by GitHub API`);
  }

  const tree = data.tree.filter((item: GitHubTreeItem) => item.type === 'blob');
  console.log(`[${requestId}] Filtered to`, tree.length, 'blobs');

  console.log(`[${requestId}] Caching tree for 3600s`);
  await redis.set(cacheKey, JSON.stringify(tree), { ex: 3600 });
  console.log(`[${requestId}] === getRepoTree END ===`);

  return tree;
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
  const requestId = `github-files-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log(`[${requestId}] === fetchFileContents START ===`);
  console.log(`[${requestId}] Owner/Repo:`, owner, repo);
  console.log(`[${requestId}] Files to fetch:`, files.length);
  
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const batchSize = 50;
  const results: FileWithContent[] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = files.slice(i, i + batchSize);
    console.log(`[${requestId}] === BATCH ${batchNum}/${Math.ceil(files.length / batchSize)} ===`, batch.length, 'files');

    const promises = batch.map(async (file) => {
      try {
        console.log(`[${requestId}] Fetching:`, file.path);
        const response = await fetch(file.url, { headers });

        if (!response.ok) {
          console.warn(`[${requestId}] Failed to fetch ${file.path}:`, response.status, response.statusText);
          return null;
        }

        const data = await response.json();

        return {
          ...file,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
        };
      } catch (error) {
        console.error(`[${requestId}] Error fetching ${file.path}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    const validResults = batchResults.filter((f): f is FileWithContent => f !== null);
    console.log(`[${requestId}] Batch completed:`, validResults.length, 'successfully fetched');

    results.push(...validResults);
  }

  console.log(`[${requestId}] === fetchFileContents END ===`, {
    totalRequested: files.length,
    successfullyFetched: results.length
  });

  return results;
}
