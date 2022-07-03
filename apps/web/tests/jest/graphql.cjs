const loader = require('graphql-tag/loader')

const transformer = {
  process(sourceText) {
    return { code: loader.call({ cacheable() {} }, sourceText) }
  }
}

module.exports = transformer
