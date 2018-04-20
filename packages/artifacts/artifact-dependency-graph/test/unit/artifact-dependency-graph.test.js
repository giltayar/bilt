'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const {dependencyGraphSubsetToBuild, buildsThatCanBeBuilt} = require('../..')

describe('artifact-dependency-graph', function() {
  describe('dependencyGraphSubsetToBuild', () => {
    describe('changedFiles', () => {
      it('should return nothing if it"s only that', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

        expect(dependencyGraphSubsetToBuild(diamond, ['a'])).to.eql({})
      })
    })
    describe('fromArtifacts', () => {
      it('should work with diamond graphs', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

        expect(dependencyGraphSubsetToBuild(diamond, ['a'], ['a'])).to.eql(diamond)
        expect(dependencyGraphSubsetToBuild(diamond, ['c'], ['c'])).to.eql({c: [], d: ['c']})
      })
      it('should work with forests', () => {
        const forest = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e']}

        expect(dependencyGraphSubsetToBuild(forest, ['a'], ['a'])).to.eql({
          a: [],
          b: ['a'],
          c: ['a'],
          d: ['b', 'c'],
        })
        expect(dependencyGraphSubsetToBuild(forest, ['e'], ['e'])).to.eql({e: [], f: ['e']})
        expect(dependencyGraphSubsetToBuild(forest, ['e', 'a'], ['e', 'a'])).to.eql(forest)
      })
      it('should work with connected forests', () => {
        const forest = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e', 'd']}

        expect(dependencyGraphSubsetToBuild(forest, ['a'], ['a'])).to.eql({
          a: [],
          b: ['a'],
          c: ['a'],
          d: ['b', 'c'],
          f: ['d'],
        })
        expect(dependencyGraphSubsetToBuild(forest, ['e'], ['e'])).to.eql({e: [], f: ['e']})
        expect(dependencyGraphSubsetToBuild(forest, ['c', 'd'], ['c', 'd'])).to.eql({
          c: [],
          d: ['c'],
          f: ['d'],
        })
      })
      it('should work with multi-level graphs', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(dependencyGraphSubsetToBuild(forest, ['a'], ['a'])).to.eql(forest)
        expect(dependencyGraphSubsetToBuild(forest, ['c'], ['c'])).to.eql({
          c: [],
          d: ['c'],
          f: ['c'],
        })
      })
    })
  })

  describe('artifactsThaCanBeBuilt', () => {
    it('it works', () => {
      const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: [], f: ['e', 'c']}

      expect(buildsThatCanBeBuilt(forest, [])).to.eql(['a', 'e'])
      expect(buildsThatCanBeBuilt(forest, ['a', 'e'])).to.eql(['b'])
      expect(buildsThatCanBeBuilt(forest, ['a', 'e', 'c'])).to.eql(['b', 'd', 'f'])
    })
  })
})
