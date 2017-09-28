'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const {artifactsToBuildFromChange, buildsThatCanBeBuilt} = require('../..')

describe('artifact-dependency-graph', function() {
  describe('artifactsToBuildFromChange', () => {
    it('should work with diamond graphs', () => {
      const diamond = {a: [], b: ['a'], c: ['a'], d: ['b', 'c']}

      expect(artifactsToBuildFromChange(diamond, ['a'])).to.eql(diamond)
      expect(artifactsToBuildFromChange(diamond, ['c'])).to.eql({c: [], d: ['c']})
    })
    it('should work with forests', () => {
      const forest = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e']}

      expect(artifactsToBuildFromChange(forest, [
          'a',
        ])).to.eql({a: [], b: ['a'], c: ['a'], d: ['b', 'c']})
      expect(artifactsToBuildFromChange(forest, ['e'])).to.eql({e: [], f: ['e']})
      expect(artifactsToBuildFromChange(forest, ['e', 'a'])).to.eql(forest)
    })
    it('should work with connected forests', () => {
      const forest = {a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e', 'd']}

      expect(artifactsToBuildFromChange(forest, [
          'a',
        ])).to.eql({a: [], b: ['a'], c: ['a'], d: ['b', 'c'], f: ['d']})
      expect(artifactsToBuildFromChange(forest, ['e'])).to.eql({e: [], f: ['e']})
      expect(artifactsToBuildFromChange(forest, ['c', 'd'])).to.eql({c: [], d: ['c'], f: ['d']})
    })
    it('should work with multi-level graphs', () => {
      const forest = {a: [], b: ['a'], c: ['b'], d: ['c', 'a'], e: ['b'], f: ['e', 'c']}

      expect(artifactsToBuildFromChange(forest, ['a'])).to.eql(forest)
      expect(artifactsToBuildFromChange(forest, ['c'])).to.eql({c: [], d: ['c'], f: ['c']})
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

/*
]lass TestDependencyTree(unittest.TestCase):

    def test_builds_that_can_be_built(self):
        forest = {
            1: set(),
            2: {1},
            3: {2},
            4: {3, 1},
            5: set(),
            6: {5, 3}
        }
        self.assertItemsEqual(list(builds_that_can_be_built(forest, set())), [1, 5])
        self.assertItemsEqual(list(builds_that_can_be_built(forest, {1, 5})), [2])
        self.assertItemsEqual(list(builds_that_can_be_built(forest, {1, 5, 3})), [2, 4, 6])
*/
