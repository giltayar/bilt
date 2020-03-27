import {describe, it} from 'mocha'
import {expect} from 'chai'

import {buildJustChangedPackages, forceBuild} from '../../src/ng-e2e'
import {
  gitMakeTemporaryDirectory,
  gitInit,
  gitWrite,
  gitWritePackageJson,
  gitCommitAll,
} from './e2e-git-utils'
import {logFilesDuringBuild} from './e2e-build-utils'

describe('buildJustChangedPackages (e2e)', function () {
  it('should build only changed packages', async () => {
    const gitDir = await gitMakeTemporaryDirectory()
    await gitInit(gitDir)
    await gitWrite(gitDir, '.gitignore', '.bilt\n')

    await gitWritePackageJson(gitDir, 'adir/package.json', 'a-package')
    await gitWrite(gitDir, 'adir/hello.txt', 'hello')

    await gitWritePackageJson(gitDir, 'bdir/package.json', 'b-package')
    await gitWrite(gitDir, 'bdir/boogie.txt', 'boogie')

    await gitCommitAll(gitDir)

    const build1 = {}
    await forceBuild(gitDir, logFilesDuringBuild(gitDir, build1))
    expect(build1).to.eql({'adir/hello.txt': 'hello', 'bdir/boogie.txt': 'boogie'})

    const build2 = {}
    await buildJustChangedPackages(gitDir, logFilesDuringBuild(gitDir, build2))
    expect(build2).to.eql({})

    const build3 = {}
    await gitWrite(gitDir, 'adir/hello.txt', 'hello1')
    await gitCommitAll(gitDir)
    await buildJustChangedPackages(gitDir, logFilesDuringBuild(gitDir, build3))
    expect(build3).to.eql({'adir/hello.txt': 'hello1'})
  })
})
