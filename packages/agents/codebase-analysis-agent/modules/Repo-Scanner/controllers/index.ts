import { repoScannerService } from "../services";

export async function fetchRepo(repoUrl: string){
    try {
        const response = await repoScannerService.fetchRepo(repoUrl);
        return response;
    } catch (error) {
        throw new Error(`Failed to fetch repository: ${error}`);
    }
}