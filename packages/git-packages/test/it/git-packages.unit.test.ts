import {promisify} from 'util'
import {exec} from 'child_process'
import {describe, it} from 'mocha'
import {expect} from 'chai'
import {init, makeTemporaryDirectory, writeFile, commitAll} from '@applitools/git-testkit'

import {
  findChangedFiles,
  findChangedPackagesUsingLastSuccesfulBuild,
  findLatestPackageChanges,
} from '../../src/git-packages'
import {Commitish, RelativeFilePath, Directory, RelativeDirectoryPath} from '@bilt/types'

describe('git-packages (it)', function () {
  describe('findChangedFiles', () => {
    it('should be able find files changes between two commit in this repo (it will not include the files in fromCommit', async () => {
      const changedFilesInGit = await findChangedFiles({
        rootDirectory: __dirname as Directory,
        fromGitDate: 'Sat Feb 15 21:30:36 2020 +0200', //79921a9be6ef8b509326220f4de55a3e7817d9cc
        toCommit: 'f02bc9d5aef8531d9aeab19613920f933e87ad89' as Commitish,
        includeWorkspaceFiles: false,
      })

      expect(changedFilesInGit).to.eql(
        toChangedFilesInGit([
          ['f02bc9d5aef8531d9aeab19613920f933e87ad89', ['packages/ng-packages/package.json']],
          [
            '0307438373a557e69cb6aa5532f61df694199e3e',
            [
              'packages/ng-packages/package-lock.json',
              'packages/ng-packages/package.json',
              'packages/ng-packages/src/ng-packages.ts',
              'packages/ng-packages/test/unit/find-npm-package-infos.unit.test.ts',
              'packages/ng-packages/test/unit/find-npm-packages.unit.test.ts',
              'packages/ng-packages/test/unit/ng-build.unit.test.ts',
              'packages/ng-packages/test/unit/test-repo/a/package.json',
              'packages/ng-packages/test/unit/test-repo/adir/b/package.json',
              'packages/ng-packages/tsconfig.json',
            ],
          ],
          ['79921a9be6ef8b509326220f4de55a3e7817d9cc', ['bilt.code-workspace']],
        ]),
      )
    })

    it('should be able to find changed files that have not yet been commited', async () => {
      const gitDir = await makeTemporaryDirectory()
      await init(gitDir)

      await writeFile(gitDir, 'a', '1')
      await writeFile(gitDir, 'b', '1')
      await writeFile(gitDir, 'c', '1')
      await commitAll(gitDir)

      await writeFile(gitDir, 'b', '2')
      await writeFile(gitDir, 'c', '2')
      await promisify(exec)('git add b', {cwd: gitDir})

      const changedFiles = await findChangedFiles({rootDirectory: gitDir as Directory})

      expect([...changedFiles.values()][0]).to.have.members(['b', 'c'])
      expect([...changedFiles.values()][1]).to.have.members(['a', 'b', 'c'])
    })
  })

  describe('findChangedPackagesUsingLastSuccesfulBuild', () => {
    const changedFilesInGit = toChangedFilesInGit([
      ['2', ['a/foo.txt', 'a/boo.txt', 'c/foo.txt']],
      ['1.5', ['c/foo.txt', 'b/foo.txt']],
      ['1', ['a/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']],
      ['0', ['c/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']],
      ['-1', ['c/foo.txt', 'a/boo.txt', 'b/foo.txt']],
    ])

    const pa = {directory: 'a' as RelativeDirectoryPath}
    const pb = {directory: 'b' as RelativeDirectoryPath}

    it('should find no packages if last succesful build is the HEAD', async () => {
      const changedPackages = findChangedPackagesUsingLastSuccesfulBuild({
        changedFilesInGit,
        lastSuccesfulBuildOfPackages: [{package: pa, lastSuccesfulBuild: '2' as Commitish}],
      })

      expect(changedPackages).to.eql([])
    })

    it('should find changed packages in HEAD if it is the only one that was not built', async () => {
      const changedPackages = findChangedPackagesUsingLastSuccesfulBuild({
        changedFilesInGit,
        lastSuccesfulBuildOfPackages: [
          {package: pa, lastSuccesfulBuild: '1' as Commitish},
          {package: pb, lastSuccesfulBuild: '1' as Commitish},
        ],
      })

      expect(changedPackages).to.eql([
        {package: pa, commit: '2'},
        {package: pb, commit: '1.5'},
      ])
    })

    it('should find only one changed packages in HEAD if the other one was last built in HEAD', async () => {
      const changedPackages = findChangedPackagesUsingLastSuccesfulBuild({
        changedFilesInGit,
        lastSuccesfulBuildOfPackages: [
          {package: pa, lastSuccesfulBuild: '1' as Commitish},
          {package: pb, lastSuccesfulBuild: '2' as Commitish},
        ],
      })

      expect(changedPackages).to.eql([{package: pa, commit: '2'}])
    })
  })

  describe('findLatestPackageChanges', () => {
    const changedFilesInGit = toChangedFilesInGit([
      ['2', ['a/foo.txt', 'a/boo.txt', 'c/foo.txt']],
      ['1.5', ['c/foo.txt', 'b/foo.txt']],
      ['1', ['a/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']],
      ['0', ['c/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']],
      ['-1', ['c/foo.txt', 'a/boo.txt', 'b/foo.txt']],
    ])

    const pa = {directory: 'a' as RelativeDirectoryPath}
    const pb = {directory: 'b' as RelativeDirectoryPath}
    const pc = {directory: 'c' as RelativeDirectoryPath}
    const pd = {directory: 'd' as RelativeDirectoryPath}
    const packages = [pa, pb, pc, pd]

    it('should find no packages if last succesful build is the HEAD', async () => {
      const changedPackages = findLatestPackageChanges({
        changedFilesInGit,
        packages: [pd],
      })

      expect(changedPackages).to.eql([])
    })

    it('should find changed latest change in packages', async () => {
      const changedPackages = findLatestPackageChanges({
        changedFilesInGit,
        packages,
      })

      expect(changedPackages).to.have.deep.members([
        {package: pa, commit: '2'},
        {package: pb, commit: '1.5'},
        {package: pc, commit: '2'},
      ])
    })
  })
})

function toChangedFilesInGit(raw: [string, string[]][]) {
  return new Map<Commitish, RelativeFilePath[]>(
    raw.map(([commitish, filePaths]) => [commitish as Commitish, filePaths as RelativeFilePath[]]),
  )
}
