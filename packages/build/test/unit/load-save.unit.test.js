import os from 'os'
import fs from 'fs'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'

import {saveCommitOfLastSuccesfulBuild, loadCommitsOfLastSuccesfulBuilds} from '../../src/build.js'

/**
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('@bilt/types').Directory} Directory
 * @typedef {import('@bilt/types').Commitish} Commitish
 */

describe('load-save (unit)', function () {
  const pa = /**@type {Package}*/ ({directory: 'adir'})
  const pb = /**@type {Package}*/ ({directory: 'packages/bdir'})
  const pc = /**@type {Package}*/ ({directory: 'cdir'})
  const packages = [pa, pb, pc]

  it('load an empty dir with undefined', async () => {
    const rootDirectory = /**@type {Directory}*/ (await fs.promises.mkdtemp(os.tmpdir + '/'))

    expect(await loadCommitsOfLastSuccesfulBuilds(rootDirectory, packages)).to.eql([])
  })

  it('load a succesful build result if one was saved', async () => {
    const rootDirectory = /**@type {Directory}*/ (await fs.promises.mkdtemp(os.tmpdir + '/'))

    await saveCommitOfLastSuccesfulBuild(
      rootDirectory,
      /**@type {import('../../src/build').BuildPackageResult}*/ ({
        buildResult: 'success',
        package: packages[1],
      }),
      /**@type {Commitish}*/ ('123'),
    )

    expect(await loadCommitsOfLastSuccesfulBuilds(rootDirectory, packages)).to.eql([
      {package: pb, lastSuccesfulBuild: '123'},
    ])
  })

  it('an unsuccesful build result does not overwrite a succesful one', async () => {
    const rootDirectory = /**@type {Directory}*/ (await fs.promises.mkdtemp(os.tmpdir + '/'))

    await saveCommitOfLastSuccesfulBuild(
      rootDirectory,
      {buildResult: 'success', package: packages[1]},
      /**@type {Commitish}*/ ('123'),
    )

    await saveCommitOfLastSuccesfulBuild(
      rootDirectory,
      {buildResult: 'failure', package: packages[1]},
      /**@type {Commitish}*/ ('456'),
    )
    await saveCommitOfLastSuccesfulBuild(
      rootDirectory,
      {buildResult: 'failure', package: packages[0]},
      /**@type {Commitish}*/ ('456'),
    )

    expect(await loadCommitsOfLastSuccesfulBuilds(rootDirectory, packages)).to.eql([
      {package: pb, lastSuccesfulBuild: '123'},
    ])
  })

  it('a succesful build result overwrites previous succesful one', async () => {
    const rootDirectory = /**@type {Directory}*/ (await fs.promises.mkdtemp(os.tmpdir + '/'))

    await saveCommitOfLastSuccesfulBuild(
      rootDirectory,
      {buildResult: 'success', package: packages[1]},
      /**@type {Commitish}*/ ('123'),
    )
    await saveCommitOfLastSuccesfulBuild(
      rootDirectory,
      {buildResult: 'success', package: packages[1]},
      /**@type {Commitish}*/ ('456'),
    )
    await saveCommitOfLastSuccesfulBuild(
      rootDirectory,
      {buildResult: 'success', package: packages[0]},
      /**@type {Commitish}*/ ('456'),
    )

    expect(await loadCommitsOfLastSuccesfulBuilds(rootDirectory, packages)).to.eql([
      {package: pa, lastSuccesfulBuild: '456'},
      {package: pb, lastSuccesfulBuild: '456'},
    ])
  })
})
