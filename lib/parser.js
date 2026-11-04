const babel = require('@babel/parser');

// Legacy browser scripts are not modules: HTML comments, sloppy-mode syntax and
// top-level `return` must parse. Tokens are required by recast.
const OPTIONS = {
  sourceType: 'unambiguous',
  allowReturnOutsideFunction: true,
  allowUndeclaredExports: true,
  tokens: true,
};

module.exports = {
  parse(code) {
    return babel.parse(code, OPTIONS);
  },
};
