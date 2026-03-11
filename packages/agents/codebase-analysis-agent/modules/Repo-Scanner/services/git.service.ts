import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"

const execAsync = promisify(exec)

export class GitService {

  private reposDir = "./repos"

  async cloneOrUpdateRepo(repoUrl: string) {

    const last = repoUrl.split("/").pop();
    const repoName = (last ?? "repo").replace(/\.git$/, "") || "repo";
    const repoPath = path.join(this.reposDir, repoName)

    if (!fs.existsSync(repoPath)) {

      await execAsync(`git clone ${repoUrl} ${repoPath}`)

    } else {

      await execAsync(`git -C ${repoPath} pull`)

    }

    return repoPath
  }

  async checkoutBranch(repoPath: string, branch: string) {

    await execAsync(`git -C ${repoPath} checkout ${branch}`)

  }
}