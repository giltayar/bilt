import {describe, it} from 'mocha'
import {expect} from 'chai'

import {findChangedFiles} from '../../src/ng-what-to-build'

describe('findChangedFiles (it)', function() {
  it('should be able find files changes between two commit in this repo (it will not include the files in fromCommit', async () => {
    const filePaths = await findChangedFiles({
      rootDirectory: __dirname,
      fromCommit: '79921a9be6ef8b509326220f4de55a3e7817d9cc',
      toCommit: 'f02bc9d5aef8531d9aeab19613920f933e87ad89',
    })

    expect(filePaths).to.have.members([
      'packages/ng-packages/package-lock.json',
      'packages/ng-packages/package.json',
      'packages/ng-packages/src/ng-packages.ts',
      'packages/ng-packages/test/unit/find-npm-package-infos.unit.test.ts',
      'packages/ng-packages/test/unit/find-npm-packages.unit.test.ts',
      'packages/ng-packages/test/unit/ng-build.unit.test.ts',
      'packages/ng-packages/test/unit/test-repo/a/package.json',
      'packages/ng-packages/test/unit/test-repo/adir/b/package.json',
      'packages/ng-packages/tsconfig.json',
    ])
  })

  it('should return empty array if from and to are the same', async () => {
    const filePaths = await findChangedFiles({
      rootDirectory: __dirname,
      fromCommit: '79921a9be6ef8b509326220f4de55a3e7817d9cc',
      toCommit: '79921a9be6ef8b509326220f4de55a3e7817d9cc',
    })

    expect(filePaths).to.eql([])
  })
})
