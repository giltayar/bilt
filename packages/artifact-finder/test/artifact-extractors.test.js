'use strict'

const {describe, it} = require('mocha')
const {expect} = require('chai')
const extractorsCreator = require('../src/artifact-extractors')
const sinon = require('sinon')

describe('extractors', function() {
  describe('npm extractor', function() {
    const basedir = '/foo/bar'
    const filename = `${basedir}/gar/package.json`

    it('should put relative path correctly in artifact', async function() {
      const fileFetcher = sinon
        .stub()
        .withArgs(filename)
        .returns(
          Promise.resolve(
            JSON.stringify({
              name: 'foozilla',
            }),
          ),
        )
      const extractor = extractorsCreator(fileFetcher).npmExtractor

      expect(await extractor(filename, basedir)).to.deep.equal({
        name: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'gar',
        owners: [],
      })
    })

    it('should put correct owners', async function() {
      const fileFetcher = sinon
        .stub()
        .withArgs(filename)
        .returns(
          Promise.resolve(
            JSON.stringify({
              name: 'foozilla',
              contributors: [
                'Foo <foo@bar.com> (http://foo)',
                {name: 'Bar', email: 'bar@foo.com', url: 'http://bar'},
              ],
            }),
          ),
        )
      const extractor = extractorsCreator(fileFetcher).npmExtractor

      expect(await extractor(filename, basedir)).to.deep.equal({
        name: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'gar',
        owners: ['foo@bar.com', 'bar@foo.com'],
      })
    })

    it('should add dependencies and dev dependencies', async function() {
      const fileFetcher = sinon
        .stub()
        .withArgs(filename)
        .returns(
          Promise.resolve(
            JSON.stringify({
              name: 'foozilla',
              dependencies: {
                a: '4',
                b: '5',
              },
              devDependencies: {
                c: '6',
              },
              owners: [],
            }),
          ),
        )
      const extractor = extractorsCreator(fileFetcher).npmExtractor

      expect(await extractor(filename, basedir)).to.deep.equal({
        name: 'foozilla',
        type: 'npm',
        dependencies: ['a', 'b', 'c'],
        path: 'gar',
        owners: [],
      })
    })

    it('should ignore non-npm packages', async function() {
      const fileFetcher = sinon
        .stub()
        .withArgs(filename)
        .returns('')
      const extractor = extractorsCreator(fileFetcher).npmExtractor

      expect(await extractor(filename + '/zoo.bar', basedir)).to.be.undefined
    })
  })

  describe('artifactrc extractor', function() {
    const basedir = '/foo/bar'
    const filename = `${basedir}/gar/.artifactrc.yml`

    it('should put relative path correctly in artifact and get artifact as-is in yml', async function() {
      const fileFetcher = sinon
        .stub()
        .withArgs(filename)
        .returns(
          Promise.resolve(
            JSON.stringify({
              name: 'foozilla',
              type: 'npm',
              dependencies: [],
              owners: ['a@b'],
            }),
          ),
        )
      const extractor = extractorsCreator(fileFetcher).artifactsRcExtractor

      expect(await extractor(filename, basedir)).to.deep.equal({
        name: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'gar',
        owners: ['a@b'],
      })
    })

    it('should put relative path correctly in artifact even if there is one in yml', async function() {
      const fileFetcher = sinon
        .stub()
        .withArgs(filename)
        .returns(
          Promise.resolve(
            JSON.stringify({
              name: 'foozilla',
              type: 'npm',
              dependencies: [],
              path: 'wrong-path',
              owners: [],
            }),
          ),
        )
      const extractor = extractorsCreator(fileFetcher).artifactsRcExtractor

      expect(await extractor(filename, basedir)).to.deep.equal({
        name: 'foozilla',
        type: 'npm',
        dependencies: [],
        path: 'gar',
        owners: [],
      })
    })

    it('should not have a type if its not in the artifactrc.yml', async function() {
      const fileFetcher = sinon
        .stub()
        .withArgs(filename)
        .returns(
          Promise.resolve(
            JSON.stringify({
              name: 'foozilla',
              dependencies: [],
              path: 'wrong-path',
              owners: [],
            }),
          ),
        )
      const extractor = extractorsCreator(fileFetcher).artifactsRcExtractor

      expect(await extractor(filename, basedir)).to.deep.equal({
        name: 'foozilla',
        dependencies: [],
        path: 'gar',
        owners: [],
      })
    })
  })
  describe('extractor merger', function() {
    const extractorMerger = extractorsCreator(s => s).extractorMerger

    it('should returned undefined on an empty list', function() {
      expect(extractorMerger([])).to.be.undefined
    })

    it('merge dependencies from npm and artifactrc', function() {
      const merged = extractorMerger([
        {type: 'npm', name: 'n', dependencies: ['a']},
        {name: 'c', dependencies: ['b', 'a']},
      ])

      expect(merged).to.deep.equal({type: 'npm', name: 'c', dependencies: ['a', 'b']})
    })
  })
})
