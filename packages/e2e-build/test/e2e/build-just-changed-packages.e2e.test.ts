import {describe, it} from 'mocha'
import {expect} from 'chai'
import {
  makeTemporaryDirectory,
  init,
  writeFile,
  writePackageJson,
  commitAll,
} from '@bilt/git-testkit'
import {logFilesDuringBuild} from '@bilt/build-testkit'
import {Directory} from '@bilt/types'

import {buildJustChangedPackages, forceBuild} from '../../src/e2e-build'

describe('buildJustChangedPackages (e2e)', function () {
  it('should build only changed packages', async () => {
    const gitDir = (await makeTemporaryDirectory()) as Directory
    await init(gitDir)
    await writeFile(gitDir, '.gitignore', '.bilt\n')

    await writePackageJson(gitDir, 'adir/package.json', 'a-package')
    await writeFile(gitDir, 'adir/hello.txt', 'hello')

    await writePackageJson(gitDir, 'bdir/package.json', 'b-package')
    await writeFile(gitDir, 'bdir/boogie.txt', 'boogie')

    await commitAll(gitDir)

    const build1 = {}
    await forceBuild(gitDir, logFilesDuringBuild(gitDir, build1))
    expect(build1).to.eql({'adir/hello.txt': 'hello', 'bdir/boogie.txt': 'boogie'})

    const build2 = {}
    await buildJustChangedPackages(gitDir, logFilesDuringBuild(gitDir, build2))
    expect(build2).to.eql({})

    const build3 = {}
    await writeFile(gitDir, 'adir/hello.txt', 'hello1')
    await commitAll(gitDir)
    await buildJustChangedPackages(gitDir, logFilesDuringBuild(gitDir, build3))
    expect(build3).to.eql({'adir/hello.txt': 'hello1'})
  })
})
