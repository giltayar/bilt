import os from 'os'
import fs from 'fs'
import {describe, it} from 'mocha'
import {expect} from 'chai'

import {saveCommitOfLastSuccesfulBuild, loadCommitsOfLastSuccesfulBuilds} from '../../src/ng-build'
import {Package} from '@bilt/types'

describe('load-save (unit)', function () {
  const pa = {directory: 'adir'}
  const pb = {directory: 'packages/bdir'}
  const pc = {directory: 'cdir'}
  const packages: Package[] = [pa, pb, pc]

  it('load an empty dir with undefined', async () => {
    const rootDirectory = await fs.promises.mkdtemp(os.tmpdir + '/')

    expect(await loadCommitsOfLastSuccesfulBuilds({rootDirectory, packages})).to.eql([])
  })

  it('load a succesful build result if one was saved', async () => {
    const rootDirectory = await fs.promises.mkdtemp(os.tmpdir + '/')

    await saveCommitOfLastSuccesfulBuild({
      rootDirectory,
      buildPackageResult: {buildResult: 'success', package: packages[1]},
      commit: '123',
    })

    expect(await loadCommitsOfLastSuccesfulBuilds({rootDirectory, packages})).to.eql([
      {package: pb, lastSuccesfulBuild: '123'},
    ])
  })

  it('an unsuccesful build result does not overwrite a succesful one', async () => {
    const rootDirectory = await fs.promises.mkdtemp(os.tmpdir + '/')

    await saveCommitOfLastSuccesfulBuild({
      rootDirectory,
      buildPackageResult: {buildResult: 'success', package: packages[1]},
      commit: '123',
    })
    await saveCommitOfLastSuccesfulBuild({
      rootDirectory,
      buildPackageResult: {buildResult: 'failure', package: packages[1]},
      commit: '456',
    })
    await saveCommitOfLastSuccesfulBuild({
      rootDirectory,
      buildPackageResult: {buildResult: 'failure', package: packages[0]},
      commit: '456',
    })

    expect(await loadCommitsOfLastSuccesfulBuilds({rootDirectory, packages})).to.eql([
      {package: pb, lastSuccesfulBuild: '123'},
    ])
  })

  it('a succesful build result overwrites previous succesful one', async () => {
    const rootDirectory = await fs.promises.mkdtemp(os.tmpdir + '/')

    await saveCommitOfLastSuccesfulBuild({
      rootDirectory,
      buildPackageResult: {buildResult: 'success', package: packages[1]},
      commit: '123',
    })
    await saveCommitOfLastSuccesfulBuild({
      rootDirectory,
      buildPackageResult: {buildResult: 'success', package: packages[1]},
      commit: '456',
    })
    await saveCommitOfLastSuccesfulBuild({
      rootDirectory,
      buildPackageResult: {buildResult: 'success', package: packages[0]},
      commit: '456',
    })

    expect(await loadCommitsOfLastSuccesfulBuilds({rootDirectory, packages})).to.eql([
      {package: pa, lastSuccesfulBuild: '456'},
      {package: pb, lastSuccesfulBuild: '456'},
    ])
  })
})
