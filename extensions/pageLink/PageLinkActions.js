import { Extension } from 'https://esm.sh/@tiptap/core';

export const PageLinkActions = Extension.create({
  name: 'pageLinkActions',

  addOptions() {
    return {
      onShowPanel: () => {},
      onHidePanel: () => {},
      onInsert: () => {},
    };
  },

  addCommands() {
    return {
      showPageLinkPanel: () => () => {
        if (typeof this.options.onShowPanel === 'function') {
          this.options.onShowPanel();
        }
        return true;
      },
      hidePageLinkPanel: () => () => {
        if (typeof this.options.onHidePanel === 'function') {
          this.options.onHidePanel();
        }
        return true;
      },
      insertPageLinkFromSuggestion: attrs => ({ editor }) => {
        if (typeof this.options.onInsert === 'function') {
          const handled = this.options.onInsert(attrs, editor);
          if (handled === false) {
            return false;
          }
        }
        return true;
      },
    };
  },
});

export default PageLinkActions;
