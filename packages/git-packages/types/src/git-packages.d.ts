/**
 * @param {{
 *  fromGitDate?: string
 *  toCommit?: Commitish
 *  rootDirectory?: Directory
 *  includeWorkspaceFiles?: boolean
 * }} options
 * @returns {Promise<ChangedFilesInGit>}
 */
export function findChangedFiles({ rootDirectory, fromGitDate, toCommit, includeWorkspaceFiles, }: {
    fromGitDate?: string;
    toCommit?: Commitish;
    rootDirectory?: Directory;
    includeWorkspaceFiles?: boolean;
}): Promise<ChangedFilesInGit>;
/**
 */
/**
 * @typedef {{
 *  package: Package
 *  commit: Commitish
 *  commitTime: Date
 * }} PackageChange
 */
/**
 *
 * @param {{
 *  changedFilesInGit: ChangedFilesInGit
 *  packages: Package[]
 * }} options
 * @returns {PackageChange[]}
 */
export function findLatestPackageChanges({ changedFilesInGit, packages }: {
    changedFilesInGit: ChangedFilesInGit;
    packages: Package[];
}): PackageChange[];
/**
 * @typedef {import('@bilt/types').RelativeFilePath} RelativeFilePath
 * @typedef {import('@bilt/types').Commitish} Commitish
 * @typedef {import('@bilt/types').Directory} Directory
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('@bilt/types').RelativeDirectoryPath} RelativeDirectoryPath
 */
/**
 * @typedef {{commitTime: Date; files: RelativeFilePath[]}} CommitInfo
 * @typedef {Map<Commitish, CommitInfo>} ChangedFilesInGit
 */
export const FAKE_COMMITISH_FOR_UNCOMMITED_FILES: Commitish;
export type PackageChange = {
    package: Package;
    commit: Commitish;
    commitTime: Date;
};
export type RelativeFilePath = import('@bilt/types').RelativeFilePath;
export type Commitish = import('@bilt/types').Commitish;
export type Directory = import('@bilt/types').Directory;
export type Package = import('@bilt/types').Package;
export type RelativeDirectoryPath = import('@bilt/types').RelativeDirectoryPath;
export type CommitInfo = {
    commitTime: Date;
    files: RelativeFilePath[];
};
export type ChangedFilesInGit = Map<Commitish, CommitInfo>;
//# sourceMappingURL=git-packages.d.ts.map