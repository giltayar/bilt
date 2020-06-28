'use strict'
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/resources");
  return {
    markdownTemplateEngine: 'ejs',
    htmlTemplateEngine: 'ejs',
    dir: {
      input: "src",
      output: "dist"
    }
  }
}

