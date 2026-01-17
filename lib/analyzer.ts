import { getRepoMetadata, getRepoTree, fetchFileContents, GitHubTreeItem, FileWithContent } from './github';
import { selectFiles } from './file-selector';
import { analyzeCodebase, AnalysisResult } from './gemini';

export async function analyzeRepo(
  repoUrl: string,
  options: {
    geminiKey: string;
    githubToken?: string;
    userOS?: string;
  }
): Promise<AnalysisResult> {
  const { geminiKey, githubToken, userOS } = options;

  const metadata = await getRepoMetadata(repoUrl, githubToken);

  if (metadata.private) {
    throw new Error('Cannot analyze private repositories');
  }

  const sizeInMB = metadata.size / (1024 * 1024);

  if (sizeInMB > 100) {
    throw new Error('Repository exceeds 100MB limit');
  }

  const [owner, repo] = metadata.full_name.split('/');

  const tree = await getRepoTree(owner, repo, githubToken);

  const selectedFiles = selectFiles(tree);

  console.log(`Selected ${selectedFiles.length} files for analysis out of ${tree.length} total files`);

  const filesWithContent = await fetchFileContents(
    owner,
    repo,
    selectedFiles,
    githubToken
  );

  console.log(`Fetched ${filesWithContent.length} files with content`);

  if (filesWithContent.length === 0) {
    throw new Error('No files could be fetched from the repository');
  }

  const result = await analyzeCodebase(filesWithContent, metadata.full_name, userOS, geminiKey);

  return result;
}
