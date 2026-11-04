// Order matters: attribute renames run before the nav rule so it sees final markup.
const JS_RULES = [
  { name: 'jq-removed-apis', transform: require('./jq-removed-apis') },
  { name: 'jq-deprecated-events', transform: require('./jq-deprecated-events') },
  { name: 'bs5-js-selectors', transform: require('./bs5-js-selectors') },
  { name: 'bs5-js-html-strings', transform: require('./bs5-js-html-strings') },
  { name: 'bs5-nav-active', transform: require('./bs5-nav-active') },
];

const HTML_RULES = ['bs5-attrs', 'bs5-nav-active'];

module.exports = { JS_RULES, HTML_RULES };
