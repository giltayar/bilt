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
    await writeFile('.biltrc.json', {packages: ['./*']}, {cwd})

    await runBuildCli(join(cwd, 'c'), 'build c in its own directory', ['.'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')

    await runBuildCli(cwd, 'build all', ['--upto=./a'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it(`build prompt for message`, async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)
    await writeFile('.biltrc.json', {packages: ['./*']}, {cwd})

    const {stdout} = await runBuildCli(
      join(cwd, 'c'),
      undefined,
      ['.'],
      undefined,
      'build c in its own directory',
    )

    expect(stdout).to.include('message').and.to.include('build c in its own directory')

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should show a warning on NO_LinkeD_UPTO', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)
    await writeFile('.biltrc.json', {packages: ['./*'], upto: ['./c']}, {cwd})

    const {stderr} = await runBuildCli(cwd, 'build a', undefined, ['./a'])

    expect(stderr).to.include('none of the uptos is linked')
  })

  it('should fail if the build fails', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)

    await writeFile('.biltrc.json', {packages: ['./*']}, {cwd})

    await setNpmScript(cwd, 'a', 'build', 'false')

    const [err] = await runBuildCli(cwd, 'build a', undefined, ['./a']).then(
      (v) => [undefined, v],
      (err) => [err],
    )

    expect(err).to.not.be.undefined
    expect(err.stderr).to.include('build package failed')
  })

  it('should display list of packages to build in build order when `--dry-run`', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)
    await writeFile('.biltrc.json', {packages: ['./*']}, {cwd})

    const {stdout} = await runBuildCli(cwd, undefined, ['--dry-run', '--upto=./a'])

    expect(stdout.trim()).to.equal('c, b, a')
  })
})
