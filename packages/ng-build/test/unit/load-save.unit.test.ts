import os from 'os'
import fs from 'fs'
import {describe, it} from 'mocha'
import {expect} from 'chai'

import {saveCommitOfLastSuccesfulBuild, loadCommitsOfLastSuccesfulBuilds} from '../../src/ng-build'
import {Package} from '@bilt/ng-packages'

describe('load-save (unit)', function() {
  const packages: Package[] = [
    {directory: 'adir'},
    {directory: 'packages/bdir'},
    {directory: 'cdir'},
  ]

  it('load an empty dir with undefined', async () => {
    const rootDirectory = await fs.promises.mkdtemp(os.tmpdir + '/')

    expect(await loadCommitsOfLastSuccesfulBuilds({rootDirectory, packages})).to.eql([
      undefined,
      undefined,
      undefined,
    ])
  })

  it('load a succesful build result if one was saved', async () => {
    const rootDirectory = await fs.promises.mkdtemp(os.tmpdir + '/')

    await saveCommitOfLastSuccesfulBuild({
      rootDirectory,
      buildPackageResult: {buildResult: 'success', package: packages[1]},
      commit: '123',
    })

    expect(await loadCommitsOfLastSuccesfulBuilds({rootDirectory, packages})).to.eql([
      undefined,
      {commit: '123'},
      undefined,
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
      undefined,
      {commit: '123'},
      undefined,
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
      {commit: '456'},
      {commit: '456'},
      undefined,
    ])
  })
})
