// Single source of truth for Bootstrap 5 attribute rules. GSP HTML, business JS
// selectors and HTML built in JS strings must all read from here.

const TOGGLE_VALUES = new Set(['modal', 'dropdown', 'tab', 'pill', 'collapse', 'tooltip', 'popover', 'button', 'offcanvas']);
const DISMISS_VALUES = new Set(['modal', 'alert', 'toast', 'offcanvas']);

// Only renamed when the same element has a Bootstrap data-toggle.
const TOGGLE_COMPANIONS = new Set([
  'target', 'parent', 'placement', 'container', 'content', 'trigger', 'html', 'title',
  'animation', 'delay', 'selector', 'template', 'boundary', 'offset', 'reference',
  'display', 'auto-close', 'backdrop', 'keyboard',
]);

// Recognised by their value alone.
const STANDALONE = {
  ride: /^(carousel|true)$/,
  slide: /^(next|prev)$/,
  'slide-to': /^\d+$/,
  spy: /^scroll$/,
};

// Only renamed on an element carrying the given class.
const BY_CLASS = {
  modal: new Set(['backdrop', 'keyboard', 'focus']),
  carousel: new Set(['interval', 'pause', 'wrap', 'keyboard', 'touch']),
};

// Bootstrap 5 keeps .active on the <li> for these, and the Inspinia side menu is
// migrated by hand, so their li.active selectors are never rewritten or reported.
const LI_ACTIVE_UNCHANGED = /#side-menu|\.metismenu|\.pagination|\.page-item|\.breadcrumb/;
const NAV_CONTAINERS = '\\.nav-tabs|\\.nav-pills|\\.navbar-nav|\\.nav\\b';

const isDynamic = (value) => /\$\{|__GSP_\d+__|<%|<\/?[a-zA-Z]+:/.test(value);

module.exports = {
  TOGGLE_VALUES,
  DISMISS_VALUES,
  TOGGLE_COMPANIONS,
  STANDALONE,
  BY_CLASS,
  LI_ACTIVE_UNCHANGED,
  NAV_CONTAINERS,
  isDynamic,
};
