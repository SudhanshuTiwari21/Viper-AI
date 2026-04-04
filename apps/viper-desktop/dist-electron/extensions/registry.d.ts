export interface RegistryEntry {
    id: string;
    name: string;
    displayName: string;
    version: string;
    description: string;
    author: string;
    downloads: number;
    rating: number;
    tags: string[];
    repositoryUrl: string;
    packageUrl: string;
}
export declare function searchRegistry(query: string): RegistryEntry[];
export declare function getRegistryEntry(id: string): RegistryEntry | undefined;
export declare function getPopularExtensions(): RegistryEntry[];
