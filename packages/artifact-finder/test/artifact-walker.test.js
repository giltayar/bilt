import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import artifactWalker from '../src/artifact-walker.js'
import sinon from 'sinon'
const {stub} = sinon

describe('artifactWalker', function () {
  /**
   * @param {any} x
   */
  const id = (x) => x

  it('should work with just one dir', async function () {
    const dir = 'foo'
    const fetchEntriesOfDir = stub()
      .withArgs(dir, ['ignore'])
      .returns(
        Promise.resolve({
          entries: [
            {name: 'zoo.json', type: 'file'},
            {name: 'package.json', type: 'file'},
          ],
        }),
      )
    const extractArtifacts = stub()
    extractArtifacts.withArgs('foo/package.json').returns(Promise.resolve('food'))
    extractArtifacts.withArgs('foo/zoo.json').returns(Promise.resolve(undefined))

    const deps = await artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, id, 'ignore')

    expect(deps).to.deep.equal(['food'])
  })

  it('should work with two subdirs', async function () {
    const dir = 'foo'
    const fetchEntriesOfDir = stub()
    fetchEntriesOfDir.withArgs(dir, ['ignore']).returns(
      Promise.resolve({
        entries: [
          {name: 'a', type: 'dir'},
          {name: 'b', type: 'dir'},
        ],
        ignoreStack: ['ignore'],
      }),
    )
    fetchEntriesOfDir.withArgs(dir + '/a', ['ignore']).returns(
      Promise.resolve({
        entries: [
          {name: 'package.json', type: 'file'},
          {name: 'a.json', type: 'file'},
        ],
        ignoreStack: ['ignore'],
      }),
    )
    fetchEntriesOfDir.withArgs(dir + '/b', ['ignore']).returns(
      Promise.resolve({
        entries: [
          {name: 'package.json', type: 'file'},
          {name: 'b.json', type: 'file'},
        ],
        ignoreStack: ['ignore'],
      }),
    )
    const extractArtifacts = stub()
    extractArtifacts.withArgs('foo/a/package.json').returns(Promise.resolve('a'))
    extractArtifacts.withArgs('foo/a/a.json').returns(Promise.resolve(undefined))
    extractArtifacts.withArgs('foo/b/package.json').returns(Promise.resolve(['b']))
    extractArtifacts.withArgs('foo/b/b.json').returns(Promise.resolve(undefined))

    const deps = await artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, id, dir, ['ignore'])

    expect(deps).to.deep.equal(['a', 'b'])
  })

  it('should work with subdir inside another', async function () {
    const dir = 'foo'
    const fetchEntriesOfDir = stub()
    fetchEntriesOfDir
      .withArgs(dir, ['ignore'])
      .returns(Promise.resolve({entries: [{name: 'a', type: 'dir'}], ignoreStack: ['ignore']}))
    fetchEntriesOfDir.withArgs(dir + '/a', ['ignore']).returns(
      Promise.resolve({
        entries: [
          {name: 'a.json', type: 'file'},
          {name: 'b', type: 'dir'},
        ],
        ignoreStack: ['ignore'],
      }),
    )
    fetchEntriesOfDir
      .withArgs(dir + '/a/b', ['ignore'])
      .returns(
        Promise.resolve({entries: [{name: 'package.json', type: 'file'}], ignoreStack: ['ignore']}),
      )
    const extractArtifacts = stub()
    extractArtifacts.returns(Promise.resolve(undefined))
    extractArtifacts.withArgs('foo/a/a.json').returns(Promise.resolve(undefined))
    extractArtifacts.withArgs('foo/a/b/package.json').returns(Promise.resolve('b'))

    const deps = await artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, id, dir, ['ignore'])

    expect(deps).to.deep.equal(['b'])
  })

  it('should ignore subdirs of a leaf', async function () {
    const dir = 'foo'
    const fetchEntriesOfDir = stub()
    fetchEntriesOfDir
      .withArgs(dir, ['ignore'])
      .returns(Promise.resolve({entries: [{name: 'a', type: 'dir'}], ignoreStack: ['ignore']}))
    fetchEntriesOfDir.withArgs(dir + '/a', ['ignore']).returns(
      Promise.resolve({
        entries: [
          {name: 'package.json', type: 'file'},
          {name: 'a.json', type: 'file'},
          {name: 'b', type: 'dir'},
        ],
        ignoreStack: ['ignore'],
      }),
    )
    fetchEntriesOfDir
      .withArgs(dir + '/a/b', ['ignore'])
      .returns(
        Promise.resolve({entries: [{name: 'package.json', type: 'file'}], ignoreStack: ['ignore']}),
      )
    const extractArtifacts = stub()
    extractArtifacts.returns(Promise.resolve(undefined))
    extractArtifacts.withArgs('foo/a/package.json').returns(Promise.resolve('a'))
    extractArtifacts.withArgs('foo/a/a.json').returns(Promise.resolve(undefined))
    extractArtifacts.withArgs('foo/a/b/package.json').returns(Promise.resolve('b'))

    const deps = await artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, id, dir, ['ignore'])

    expect(deps).to.deep.equal(['a'])
  })

  it('should support two artifacts in a dir and combine them with extractorMerger', async function () {
    const dir = 'foo'
    const fetchEntriesOfDir = stub()
    fetchEntriesOfDir
      .withArgs(dir, ['ignore'])
      .returns(Promise.resolve({entries: [{name: 'a', type: 'dir'}], ignoreStack: ['ignore']}))
    fetchEntriesOfDir.withArgs(dir + '/a', ['ignore']).returns(
      Promise.resolve({
        entries: [
          {name: 'package.json', type: 'file'},
          {name: 'a.json', type: 'file'},
        ],
        ignoreStack: ['ignore'],
      }),
    )
    const extractArtifacts = stub()
    extractArtifacts.returns(Promise.resolve(undefined))
    extractArtifacts.withArgs('foo/a/package.json').returns(Promise.resolve('a1'))
    extractArtifacts.withArgs('foo/a/a.json').returns(Promise.resolve('a2'))

    const deps = await artifactWalker(
      fetchEntriesOfDir,
      dir,
      extractArtifacts,
      /**
       * @param {any} artifacts
       */
      (artifacts) => {
        expect(artifacts).to.have.members(['a1', 'a2'])

        return ['b1', 'b2']
      },
      dir,
      ['ignore'],
    )

    expect(deps).to.deep.equal(['b1', 'b2'])
  })
})
