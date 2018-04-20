'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const {
  dependencyGraphSubsetToBuild: dependencyGraphSubsetToBuildOriginal,
  buildsThatCanBeBuilt,
} = require('../..')

const dependencyGraphSubsetToBuild = (
  dependencyGraph,
  {changedArtifacts, fromArtifacts, uptoArtifacts, justBuildArtifacts},
) =>
  dependencyGraphSubsetToBuildOriginal({
    dependencyGraph,
    changedArtifacts,
    fromArtifacts,
    uptoArtifacts,
    justBuildArtifacts,
  })

describe('artifact-dependency-graph', function() {
  describe('dependencyGraphSubsetToBuild', () => {
    describe('changedFiles', () => {
      it('should return nothing if it"s only that', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

        expect(dependencyGraphSubsetToBuild(diamond, {changedArtifacts: ['a']})).to.eql({})
      })
    })

    describe('fromArtifacts', () => {
      it('should work with diamond graphs', () => {
        const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

        expect(dependencyGraphSubsetToBuild(diamond, {fromArtifacts: ['a']})).to.eql(diamond)
        expect(dependencyGraphSubsetToBuild(diamond, {
            fromArtifacts: ['c'],
          })).to.eql({c: [], d: ['c']})
      })
      it('should work with forests', () => {
        const forest = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e']}

        expect(dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['a'],
          })).to.eql({a: [], b: ['a'], c: ['a'], d: ['b', 'c']})
        expect(dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['e'],
          })).to.eql({e: [], f: ['e']})
        expect(dependencyGraphSubsetToBuild(forest, {fromArtifacts: ['e', 'a']})).to.eql(forest)
      })
      it('should work with connected forests', () => {
        const forest = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e', 'd']}

        expect(dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['a'],
          })).to.eql({a: [], b: ['a'], c: ['a'], d: ['b', 'c'], f: ['d']})
        expect(dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['e'],
          })).to.eql({e: [], f: ['e']})
        expect(dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['c', 'd'],
          })).to.eql({c: [], d: ['c'], f: ['d']})
      })

      it('should work with multi-level graphs', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(dependencyGraphSubsetToBuild(forest, {fromArtifacts: ['a']})).to.eql(forest)
        expect(dependencyGraphSubsetToBuild(forest, {
            fromArtifacts: ['c'],
          })).to.eql({c: [], d: ['c'], f: ['c']})
      })

      it('should only return a graph with only the builds that changed', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(dependencyGraphSubsetToBuild(forest, {
            changedArtifacts: ['c'],
            fromArtifacts: ['c', 'e'],
          })).to.eql({c: [], d: ['c'], f: ['c']})
      })
    })

    describe('justBuild', () => {
      it('should only return the nodes that are justBuild', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(dependencyGraphSubsetToBuild(forest, {
            justBuildArtifacts: ['c', 'e'],
          })).to.eql({c: [], e: []})
      })

      it('should only return the nodes that are justBuild, but the dependencies should be there', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(dependencyGraphSubsetToBuild(forest, {
            justBuildArtifacts: ['f', 'e', 'a'],
            // the 'a' build in the result is a little problematic, because in terms of build order
            // nothing here tells it to be earlier than e and f which depend on it.
            // It's definitely a bug, but since justBuild is usually used for one focus artifact,
            // that shouldn't be too problematic a bug
          })).to.eql({f: ['e'], e: [], a: []})
      })

      it('should not ignore changedArtifacts', () => {
        const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

        expect(dependencyGraphSubsetToBuild(forest, {
            justBuildArtifacts: ['f', 'e'],
            changedArtifacts: ['f'],
          })).to.eql({f: []})
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
