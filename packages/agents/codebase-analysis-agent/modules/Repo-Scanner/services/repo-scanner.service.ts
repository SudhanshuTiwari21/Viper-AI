import { GitService } from "./git.service"

export class RepoScannerService {

  constructor(private gitService = new GitService()) {}

  async fetchRepo(repoUrl: string, branch = "main") {

    const repoPath = await this.gitService.cloneOrUpdateRepo(repoUrl)

    await this.gitService.checkoutBranch(repoPath, branch)

    return {
      repoPath,
      branch
    }
  }
}