import {promisify} from 'util'
import {promises as fs} from 'fs'
import {exec} from 'child_process'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import {init, makeTemporaryDirectory, writeFile, commitAll} from '@bilt/git-testkit'
import {fileURLToPath, URL} from 'url'

import {findChangedFiles, findLatestPackageChanges} from '../../src/git-packages.js'
import {join} from 'path'

/**
 * @typedef {import('@bilt/types').RelativeFilePath} RelativeFilePath
 * @typedef {import('@bilt/types').Commitish} Commitish
 * @typedef {import('@bilt/types').Directory} Directory
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('@bilt/types').RelativeDirectoryPath} RelativeDirectoryPath
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url))

describe('git-packages (integ)', function () {
  describe('findChangedFiles', () => {
    it('should be able find files changes between two commit in this repo (it will not include the files in fromCommit', async () => {
      const changedFilesInGit = await findChangedFiles({
        rootDirectory: /**@type {Directory}*/ (__dirname),
        fromGitDate: 'Sat Feb 15 21:30:36 2020 +0200', //79921a9be6ef8b509326220f4de55a3e7817d9cc
        toCommit: /**@type {Commitish}*/ ('f02bc9d5aef8531d9aeab19613920f933e87ad89'),
        includeWorkspaceFiles: false,
      })

      expect(changedFilesInGit).to.eql(
        toChangedFilesInGit([
          [
            'f02bc9d5aef8531d9aeab19613920f933e87ad89',
            [new Date('2020-03-04T19:07:00.000Z'), ['packages/ng-packages/package.json']],
          ],
          [
            '0307438373a557e69cb6aa5532f61df694199e3e',
            [
              new Date('2020-03-01T09:43:44.000Z'),
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
          ],
          [
            '79921a9be6ef8b509326220f4de55a3e7817d9cc',
            [new Date('2020-02-15T19:30:36.000Z'), ['bilt.code-workspace']],
          ],
        ]),
      )
    })

    it('should be able to find changed files that have not yet been commited', async () => {
      const gitDir = await makeTemporaryDirectory()
      await init(gitDir)

      await writeFile(gitDir, 'a', '1')
      await writeFile(gitDir, 'b', '1')
      await writeFile(gitDir, 'c', '1')
      const commitTime = Date.now()
      await commitAll(gitDir)

      await writeFile(gitDir, 'b', '2')
      await writeFile(gitDir, 'c', '2')
      await promisify(exec)('git add b', {cwd: gitDir})

      const now = Date.now()
      const changedFiles = await findChangedFiles({rootDirectory: /**@type {Directory}*/ (gitDir)})

      expect([...changedFiles.values()][0].files).to.have.members(['b', 'c'])
      expect([...changedFiles.values()][1].files).to.have.members(['a', 'b', 'c'])
      expect([...changedFiles.values()][0].commitTime.getTime()).to.be.approximately(now, 3000)
      expect([...changedFiles.values()][1].commitTime.getTime()).to.be.approximately(
        commitTime,
        3000,
      )
    })

    it('should be able to find changed files that have not yet been tracked, in a subdir', async () => {
      const gitDir = await makeTemporaryDirectory()
      await init(gitDir)

      await writeFile(gitDir, 'a', '1')
      await writeFile(gitDir, 'b', '1')
      await writeFile(gitDir, 'c', '1')
      await commitAll(gitDir)

      await writeFile(gitDir, 'b', '2')
      await writeFile(gitDir, 'c', '2')
      await fs.mkdir(join(gitDir, 'd'))
      await writeFile(gitDir, 'd/a', '3')
      await writeFile(gitDir, 'd/b', '3')
      await promisify(exec)('git add b', {cwd: gitDir})

      const now = Date.now()
      const changedFiles = await findChangedFiles({rootDirectory: /**@type {Directory}*/ (gitDir)})

      expect([...changedFiles.values()][0].files).to.have.members(['b', 'c', 'd/a', 'd/b'])
      expect([...changedFiles.values()][0].commitTime.getTime()).to.be.approximately(now, 3000)
      expect([...changedFiles.values()][1].files).to.have.members(['a', 'b', 'c'])
    })
  })

  describe('findLatestPackageChanges', () => {
    const changedFilesInGit = toChangedFilesInGit([
      ['2', [new Date(1), ['a/foo.txt', 'a/boo.txt', 'c/foo.txt']]],
      ['1.5', [new Date(2), ['c/foo.txt', 'b/foo.txt']]],
      ['1', [new Date(3), ['a/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']]],
      ['0', [new Date(4), ['c/foo.txt', 'a/boo.txt', 'b/foo.txt', 'c/foo.txt']]],
      ['-1', [new Date(5), ['c/foo.txt', 'a/boo.txt', 'b/foo.txt']]],
    ])

    const pa = {directory: 'a'}
    const pb = {directory: 'b'}
    const pc = {directory: 'c'}
    const pd = {directory: 'd'}
    const packages = [pa, pb, pc, pd]

    it('should find no packages if last successful build is the HEAD', async () => {
      const changedPackages = findLatestPackageChanges({
        changedFilesInGit,
        packages: [/**@type {Package}*/ (pd)],
      })

      expect(changedPackages).to.eql([])
    })

    it('should find changed latest change in packages', async () => {
      const changedPackages = findLatestPackageChanges({
        changedFilesInGit,
        packages: /**@type {Package[]}*/ (packages),
      })

      expect(changedPackages).to.have.deep.members([
        {package: pa, commit: '2', commitTime: new Date(1)},
        {package: pb, commit: '1.5', commitTime: new Date(2)},
        {package: pc, commit: '2', commitTime: new Date(1)},
      ])
    })
  })
})

/**
 *
 * @param {[string, [Date, string[]]][]} raw
 * @returns {Map<Commitish, import('../../src/git-packages.js').CommitInfo>}
 */
function toChangedFilesInGit(raw) {
  return new Map(
    raw.map(([commitish, [time, filePaths]]) => [
      /**@type {Commitish}*/ (commitish),
      {commitTime: time, files: /**@type {RelativeFilePath[]}*/ (filePaths)},
    ]),
  )
}
