import {join} from 'path'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import {readFileAsString, writeFile} from '@bilt/scripting-commons'
import {
  prepareGitAndNpm,
  runBuildCli,
  createAdepsBdepsCPackages,
  setNpmScript,
} from '../commons/setup-and-run.js'

describe('applitools build (e2e)', function () {
  it(`build package in current directory, then build the rest`, async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)
    await writeFile('.biltrc.json', {packages: ['*']}, {cwd})

    await runBuildCli(join(cwd, 'c'), 'build c in its own directory', ['.'], [])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')

    await runBuildCli(cwd, 'build all', undefined, ['./a'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should show a warning on NO_LinkeD_UPTO', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)
    await writeFile('.biltrc.json', {packages: ['*'], upto: ['./c']}, {cwd})

    const {stderr} = await runBuildCli(cwd, 'build a', ['./a'])

    expect(stderr).to.include('none of the uptos is linked')
  })

  it('should fail if the build fails', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)

    await writeFile('.biltrc.json', {packages: ['*']}, {cwd})

    await setNpmScript(cwd, 'a', 'build', 'false')

    const [err] = await runBuildCli(cwd, 'build a', ['./a'], []).then(
      (v) => [undefined, v],
      (err) => [err],
    )

    expect(err).to.not.be.undefined
    expect(err.stderr).to.include('build package failed')
  })

  it(`print built packages in correct order`, async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)
    await writeFile('.biltrc.json', {packages: ['*']}, {cwd})

    const {stdout: dryRunStdout} = await runBuildCli(
      cwd,
      'dry-run',
      undefined,
      ['./a'],
      ['--dry-run'],
    )
    expect(dryRunStdout.trim()).to.eql('c, b, a')

    const {stderr} = await runBuildCli(cwd, 'full 1-run', undefined, ['./a'])
    expect(stderr.trim()).to.include('building c, b, a')
  })
})
