import { showHUD, showToast, Toast, Clipboard } from "@raycast/api";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join, basename } from "path";

const execFileAsync = promisify(execFile);

interface GitHubTarget {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  name: string;
  type: "file" | "dir";
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  download_url: string | null;
}

function parseGitHubUrl(url: string): GitHubTarget | null {
  try {
    const parsed = new URL(url.trim());

    // raw.githubusercontent.com — always a file
    if (parsed.hostname === "raw.githubusercontent.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length < 4) return null;
      const [owner, repo, branch, ...pathParts] = parts;
      const path = pathParts.join("/");
      return { owner, repo, branch, path, name: basename(path), type: "file" };
    }

    // github.com — blob (file) or tree (directory)
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length < 4) return null;
      const [owner, repo, kind, branch, ...pathParts] = parts;
      const path = pathParts.join("/");

      if (kind === "blob") {
        return { owner, repo, branch, path, name: basename(path), type: "file" };
      }
      if (kind === "tree") {
        const name = pathParts.length > 0 ? pathParts[pathParts.length - 1] : repo;
        return { owner, repo, branch, path, name, type: "dir" };
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

async function ghApi(apiPath: string): Promise<string> {
  const { stdout } = await execFileAsync("/opt/homebrew/bin/gh", ["api", apiPath]);
  return stdout;
}

async function downloadFile(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  destPath: string,
): Promise<void> {
  const apiPath = `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
  const { stdout } = await execFileAsync("/opt/homebrew/bin/gh", [
    "api",
    apiPath,
    "--jq",
    ".content",
  ]);

  const content = Buffer.from(stdout.trim(), "base64");
  await mkdir(join(destPath, ".."), { recursive: true });
  await writeFile(destPath, content);
}

async function downloadDir(
  owner: string,
  repo: string,
  branch: string,
  dirPath: string,
  destDir: string,
  toast: Toast,
): Promise<number> {
  const apiPath = `/repos/${owner}/${repo}/contents/${dirPath}?ref=${branch}`;
  const raw = await ghApi(apiPath);
  const items: GitHubContentItem[] = JSON.parse(raw);

  let count = 0;

  for (const item of items) {
    if (item.type === "file") {
      const fileDest = join(destDir, item.name);
      toast.message = item.name;
      await downloadFile(owner, repo, branch, item.path, fileDest);
      count++;
    } else if (item.type === "dir") {
      const subDir = join(destDir, item.name);
      await mkdir(subDir, { recursive: true });
      count += await downloadDir(owner, repo, branch, item.path, subDir, toast);
    }
  }

  return count;
}

export default async function Command() {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Reading clipboard...",
  });

  try {
    const clipboardText = await Clipboard.readText();
    if (!clipboardText) {
      throw new Error("Clipboard is empty — copy a GitHub URL first");
    }

    const target = parseGitHubUrl(clipboardText);
    if (!target) {
      throw new Error("Not a valid GitHub file or folder URL");
    }

    const downloadsDir = join(homedir(), "Downloads");

    if (target.type === "file") {
      toast.title = `Downloading ${target.name}...`;

      const outputPath = join(downloadsDir, target.name);
      await downloadFile(target.owner, target.repo, target.branch, target.path, outputPath);

      toast.hide();
      execFileAsync("/usr/bin/afplay", ["/System/Library/Sounds/Glass.aiff"]);
      await showHUD(`✅ Downloaded ~/Downloads/${target.name}`);
    } else {
      toast.title = `Downloading folder ${target.name}/...`;

      const folderDest = join(downloadsDir, target.name);
      await mkdir(folderDest, { recursive: true });

      const count = await downloadDir(
        target.owner,
        target.repo,
        target.branch,
        target.path,
        folderDest,
        toast,
      );

      toast.hide();
      execFileAsync("/usr/bin/afplay", ["/System/Library/Sounds/Glass.aiff"]);
      await showHUD(`✅ Downloaded ${count} files to ~/Downloads/${target.name}/`);
    }
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Download failed";
    toast.message = error instanceof Error ? error.message : "Unknown error";
  }
}
