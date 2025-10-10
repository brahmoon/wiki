import { Link } from 'https://esm.sh/@tiptap/extension-link';

const parentPriority = typeof Link.config?.priority === 'number'
  ? Link.config.priority
  : 100;

export const PageLinkAwareLink = Link.extend({
  priority: parentPriority + 1,

  parseHTML() {
    const parentRules = this.parent?.() ?? [];

    return parentRules.map(rule => {
      if (!rule || typeof rule !== 'object') {
        return rule;
      }

      const originalGetAttrs = rule.getAttrs;

      return {
        ...rule,
        getAttrs: dom => {
          if (dom instanceof HTMLElement && dom.hasAttribute('data-page-link-card')) {
            return false;
          }

          return typeof originalGetAttrs === 'function'
            ? originalGetAttrs(dom)
            : undefined;
        },
      };
    });
  },
});

export default PageLinkAwareLink;
