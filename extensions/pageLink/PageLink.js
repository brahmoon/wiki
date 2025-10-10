import { Node, mergeAttributes } from 'https://esm.sh/@tiptap/core';

const DEFAULT_CARD_CLASS = 'page-link-card';

function getCardInitial({ title, pageId }) {
  const source = (title && String(title).trim()) || (pageId && String(pageId).trim());
  if (!source) {
    return '📄';
  }
  const [firstCharacter] = Array.from(source);
  if (!firstCharacter) {
    return '📄';
  }
  const upper = firstCharacter.toUpperCase();
  if (upper.length === 1 && /[A-Z0-9]/i.test(upper)) {
    return upper;
  }
  return firstCharacter;
}

function createCardAttributes(nodeAttrs = {}, HTMLAttributes = {}) {
  const { pageId = '', title = '', url = '' } = nodeAttrs;
  const {
    class: className,
    'data-page-link-card': _ignoredDataAttr,
    ...rest
  } = HTMLAttributes;
  const attributes = mergeAttributes(rest, {
    'data-page-link-card': '',
    'data-page-id': pageId,
    'data-page-title': title,
    'data-page-initial': getCardInitial({ title, pageId }),
    href: url || '#',
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  attributes.class = [DEFAULT_CARD_CLASS, className].filter(Boolean).join(' ');
  return attributes;
}

export const PageLink = Node.create({
  name: 'pageLinkCard',
  priority: 1100,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  defining: true,
  addAttributes() {
    return {
      pageId: {
        default: null,
      },
      title: {
        default: null,
      },
      url: {
        default: null,
      },
      description: {
        default: null,
      },
    };
  },
  parseHTML() {
    const parseCardElement = dom => {
      if (!(dom instanceof HTMLElement)) {
        return false;
      }
      const anchor = dom.matches('a')
        ? dom
        : dom.querySelector('a[data-page-link-card], a.page-link-card, a');
      const source = anchor instanceof HTMLElement ? anchor : dom;
      return {
        pageId: source.getAttribute('data-page-id') || source.getAttribute('data-id') || null,
        title: source.getAttribute('data-page-title') || source.querySelector('.page-link-card__title')?.textContent || null,
        url: source.getAttribute('href') || null,
        description: source.getAttribute('data-page-description') || source.querySelector('.page-link-card__meta')?.textContent || null,
      };
    };
    return [
      {
        tag: 'a[data-page-link-card]',
        priority: 1100,
        getAttrs: parseCardElement,
      },
      {
        tag: '[data-page-link-card]',
        priority: 1099,
        getAttrs: parseCardElement,
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const attrs = createCardAttributes(node.attrs, HTMLAttributes);
    if (node.attrs.description) {
      attrs['data-page-description'] = node.attrs.description;
    }
    const contentChildren = [
      ['div', { class: 'page-link-card__title' }, node.attrs.title || node.attrs.pageId || '未指定のページ'],
    ];
    const metaText = node.attrs.description || node.attrs.pageId;
    if (metaText) {
      contentChildren.push(['div', { class: 'page-link-card__meta' }, metaText]);
    }
    return ['a', attrs, ['div', { class: 'page-link-card__content' }, ...contentChildren]];
  },
  addCommands() {
    return {
      insertPageLinkCard: attrs => ({ chain }) => {
        if (!attrs || !attrs.pageId) {
          return false;
        }
        return chain()
          .focus()
          .insertContent({
            type: this.name,
            attrs: {
              pageId: attrs.pageId,
              title: attrs.title || attrs.pageId,
              url: attrs.url || '#',
              description: attrs.description || null,
            },
          })
          .run();
      },
      updatePageLinkCard: attrs => ({ chain, state }) => {
        if (!attrs || !attrs.pageId) {
          return false;
        }
        const { selection } = state;
        const { $from } = selection;
        const node = selection.node || $from.node($from.depth);
        if (!node || node.type.name !== this.name) {
          return false;
        }
        return chain()
          .focus()
          .updateAttributes(this.name, {
            pageId: attrs.pageId,
            title: attrs.title || attrs.pageId,
            url: attrs.url || '#',
            description: attrs.description || null,
          })
          .run();
      },
    };
  },
});

export default PageLink;
