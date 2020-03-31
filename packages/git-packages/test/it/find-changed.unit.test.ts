import {describe, it} from 'mocha'
import {expect} from 'chai'

import {findChangedFiles, findChangedPackages} from '../../src/git-packages'
import {Commitish, RelativeFilePath, Directory, RelativeDirectoryPath} from '@bilt/types'

describe('findChanged (it)', function () {
  describe('findChangedFiles', () => {
    it('should be able find files changes between two commit in this repo (it will not include the files in fromCommit', async () => {
      const changedFilesInGit = await findChangedFiles({
        rootDirectory: __dirname as Directory,
        fromGitDate: 'Sat Feb 15 21:30:36 2020 +0200', //79921a9be6ef8b509326220f4de55a3e7817d9cc
        toCommit: 'f02bc9d5aef8531d9aeab19613920f933e87ad89' as Commitish,
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
  })
  describe('findChangedPackages', () => {
    const changedFilesInGit = toChangedFilesInGit([
      ['2', ['a/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']],
      ['1.5', ['c/foo.txt']],
      ['1', ['a/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']],
      ['0', ['c/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']],
      ['-1', ['c/foo.txt', 'a/boo.txt', 'b/foo.txt']],
    ])

    const pa = {directory: 'a' as RelativeDirectoryPath}
    const pb = {directory: 'b' as RelativeDirectoryPath}

    it('should find no packages if last succesful build is the HEAD', async () => {
      const changedPackages = findChangedPackages({
        changedFilesInGit,
        lastSuccesfulBuildOfPackages: [{package: pa, lastSuccesfulBuild: '2' as Commitish}],
      })

      expect(changedPackages).to.eql([])
    })

    it('should find changed packages in HEAD if it is the only one that was not built', async () => {
      const changedPackages = findChangedPackages({
        changedFilesInGit,
        lastSuccesfulBuildOfPackages: [
          {package: pa, lastSuccesfulBuild: '1' as Commitish},
          {package: pb, lastSuccesfulBuild: '1' as Commitish},
        ],
      })

      expect(changedPackages).to.eql([pa, pb])
    })

    it('should find only one changed packages in HEAD if the other one was last built in HEAD', async () => {
      const changedPackages = findChangedPackages({
        changedFilesInGit,
        lastSuccesfulBuildOfPackages: [
          {package: pa, lastSuccesfulBuild: '1' as Commitish},
          {package: pb, lastSuccesfulBuild: '2' as Commitish},
        ],
      })

      expect(changedPackages).to.eql([pa])
    })
  })
})

function toChangedFilesInGit(raw: [string, string[]][]) {
  return new Map<Commitish, RelativeFilePath[]>(
    raw.map(([commitish, filePaths]) => [commitish as Commitish, filePaths as RelativeFilePath[]]),
  )
}
