import { showHUD, showToast, Toast, Clipboard, LaunchProps } from "@raycast/api";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join, basename } from "path";

const execFileAsync = promisify(execFile);

interface Arguments {
  url?: string;
}

interface GitHubFile {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  filename: string;
}

function parseGitHubUrl(url: string): GitHubFile | null {
  // Handle various GitHub URL formats:
  // https://github.com/owner/repo/blob/branch/path/to/file.ext
  // https://github.com/owner/repo/raw/branch/path/to/file.ext
  // https://raw.githubusercontent.com/owner/repo/branch/path/to/file.ext

  try {
    const parsed = new URL(url.trim());

    // raw.githubusercontent.com format
    if (parsed.hostname === "raw.githubusercontent.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length < 4) return null;
      const [owner, repo, branch, ...pathParts] = parts;
      const path = pathParts.join("/");
      return {
        owner,
        repo,
        branch,
        path,
        filename: basename(path),
      };
    }

    // github.com format
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      // owner/repo/blob/branch/path... or owner/repo/raw/branch/path...
      if (parts.length < 5) return null;
      const [owner, repo, type, branch, ...pathParts] = parts;
      if (type !== "blob" && type !== "raw") return null;
      const path = pathParts.join("/");
      return {
        owner,
        repo,
        branch,
        path,
        filename: basename(path),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export default async function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Preparing download...",
  });

  try {
    // Get URL from argument first, then fall back to clipboard
    const inputUrl = props.arguments.url?.trim() || (await Clipboard.readText())?.trim();
    if (!inputUrl) {
      throw new Error("No URL provided — paste a GitHub file URL or copy one to clipboard");
    }

    // Parse the GitHub URL
    const file = parseGitHubUrl(inputUrl);
    if (!file) {
      throw new Error("Not a valid GitHub file URL");
    }

    toast.title = `Downloading ${file.filename}...`;

    // Use gh API to get file content (handles auth automatically)
    const apiPath = `/repos/${file.owner}/${file.repo}/contents/${file.path}?ref=${file.branch}`;

    const { stdout } = await execFileAsync("/opt/homebrew/bin/gh", [
      "api",
      apiPath,
      "--jq",
      ".content",
    ]);

    // Decode base64 content
    const content = Buffer.from(stdout.trim(), "base64");

    // Ensure Downloads folder exists
    const downloadsDir = join(homedir(), "Downloads");
    await mkdir(downloadsDir, { recursive: true });

    // Write file
    const outputPath = join(downloadsDir, file.filename);
    await writeFile(outputPath, content);

    toast.hide();
    await showHUD(`✅ Downloaded to ~/Downloads/${file.filename}`);
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Download failed";
    toast.message = error instanceof Error ? error.message : "Unknown error";
  }
}
