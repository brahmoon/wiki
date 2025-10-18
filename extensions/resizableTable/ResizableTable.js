import { mergeAttributes } from 'https://esm.sh/@tiptap/core';
import { Table } from 'https://esm.sh/@tiptap/extension-table';

const DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

const toNumberOrNull = value => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sanitizeConstraints = (constraints = {}) => {
  const result = {};

  const minWidth = toNumberOrNull(constraints.minWidth);
  const maxWidth = toNumberOrNull(constraints.maxWidth);
  const minHeight = toNumberOrNull(constraints.minHeight);
  const maxHeight = toNumberOrNull(constraints.maxHeight);

  result.minWidth = Number.isFinite(minWidth) && minWidth > 0 ? Math.round(minWidth) : null;
  result.maxWidth = Number.isFinite(maxWidth) && maxWidth > 0 ? Math.round(maxWidth) : null;
  result.minHeight = Number.isFinite(minHeight) && minHeight > 0 ? Math.round(minHeight) : null;
  result.maxHeight = Number.isFinite(maxHeight) && maxHeight > 0 ? Math.round(maxHeight) : null;

  if (result.minWidth && result.maxWidth && result.minWidth > result.maxWidth) {
    result.minWidth = result.maxWidth;
  }
  if (result.minHeight && result.maxHeight && result.minHeight > result.maxHeight) {
    result.minHeight = result.maxHeight;
  }

  return result;
};

const getEditorContentWidth = editor => {
  const editorDom = editor?.view?.dom;
  if (!editorDom) return null;
  const rect = editorDom.getBoundingClientRect();
  const styles = window.getComputedStyle(editorDom);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const width = rect.width - paddingLeft - paddingRight;
  return Number.isFinite(width) && width > 0 ? width : null;
};

const parseDimension = value => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampDimensionsToConstraints = (width, height, constraints, maxEditorWidth) => {
  let nextWidth = Number.isFinite(width) && width > 0 ? width : null;
  let nextHeight = Number.isFinite(height) && height > 0 ? height : null;

  if (constraints) {
    if (constraints.minWidth && nextWidth !== null) {
      nextWidth = Math.max(nextWidth, constraints.minWidth);
    }
    if (constraints.maxWidth && nextWidth !== null) {
      nextWidth = Math.min(nextWidth, constraints.maxWidth);
    }
    if (constraints.minHeight && nextHeight !== null) {
      nextHeight = Math.max(nextHeight, constraints.minHeight);
    }
    if (constraints.maxHeight && nextHeight !== null) {
      nextHeight = Math.min(nextHeight, constraints.maxHeight);
    }
  }

  if (Number.isFinite(maxEditorWidth) && maxEditorWidth > 0 && nextWidth !== null) {
    nextWidth = Math.min(nextWidth, maxEditorWidth);
  }

  const safeWidth = nextWidth !== null ? Math.max(1, Math.round(nextWidth)) : null;
  const safeHeight = nextHeight !== null ? Math.max(1, Math.round(nextHeight)) : null;

  return {
    width: safeWidth ?? Math.max(1, Math.round(Number(width) || 0) || 1),
    height: safeHeight ?? Math.max(1, Math.round(Number(height) || 0) || 1),
  };
};

export const ResizableTable = Table.extend({
  name: 'table',

  addOptions() {
    const parentOptions = typeof Table.config.addOptions === 'function'
      ? Table.config.addOptions.call(this)
      : {};
    return {
      ...parentOptions,
      resizeConstraints: {
        minWidth: 160,
        maxWidth: 960,
        minHeight: null,
        maxHeight: null,
      },
    };
  },

  addStorage() {
    return { constraints: sanitizeConstraints(this.options.resizeConstraints || {}) };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => {
          const datasetWidth = element.getAttribute('data-width');
          if (datasetWidth !== null) return parseDimension(datasetWidth);
          const styleWidth = element.style?.width;
          if (styleWidth) return parseDimension(styleWidth.replace(/px$/, ''));
          return null;
        },
        renderHTML: attrs => {
          const value = parseDimension(attrs.width);
          return value !== null ? { 'data-width': String(value) } : {};
        },
      },
      height: {
        default: null,
        parseHTML: element => {
          const datasetHeight = element.getAttribute('data-height');
          if (datasetHeight !== null) return parseDimension(datasetHeight);
          const styleHeight = element.style?.height;
          if (styleHeight) return parseDimension(styleHeight.replace(/px$/, ''));
          return null;
        },
        renderHTML: attrs => {
          const value = parseDimension(attrs.height);
          return value !== null ? { 'data-height': String(value) } : {};
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { width, height, ...rest } = HTMLAttributes;
    const dataAttrs = {};
    const widthValue = parseDimension(width);
    const heightValue = parseDimension(height);
    if (widthValue !== null) dataAttrs['data-width'] = String(widthValue);
    if (heightValue !== null) dataAttrs['data-height'] = String(heightValue);
    return ['table', mergeAttributes(this.options.HTMLAttributes, rest, dataAttrs), ['tbody', 0]];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      const constraints = this.storage?.constraints || {};

      const container = document.createElement('div');
      container.classList.add('resizable-table');
      container.style.position = 'relative';
      container.style.display = 'inline-block';
      container.style.maxWidth = '100%';

      const tableEl = document.createElement('table');
      tableEl.classList.add('resizable-table-element');

      const baseClassNames = new Set(tableEl.classList);

      const contentDom = document.createElement('tbody');
      tableEl.appendChild(contentDom);
      container.appendChild(tableEl);

      const applyOptionAttributes = () => {
        const attrs = this.options.HTMLAttributes || {};
        Object.entries(attrs).forEach(([key, value]) => {
          if (value === false || value === null || value === undefined) {
            if (key !== 'class') {
              tableEl.removeAttribute(key);
            }
            return;
          }
          if (key === 'class') {
            String(value)
              .split(/\s+/)
              .filter(Boolean)
              .forEach(className => baseClassNames.add(className));
          } else {
            tableEl.setAttribute(key, String(value));
          }
        });
        tableEl.className = Array.from(baseClassNames).join(' ');
      };

      applyOptionAttributes();

      const applyNodeAttributes = attrs => {
        const widthValue = parseDimension(attrs.width);
        const heightValue = parseDimension(attrs.height);

        if (widthValue !== null) {
          tableEl.style.width = `${widthValue}px`;
          tableEl.setAttribute('data-width', String(widthValue));
        } else {
          tableEl.style.removeProperty('width');
          tableEl.removeAttribute('data-width');
        }

        if (heightValue !== null) {
          tableEl.style.height = `${heightValue}px`;
          tableEl.setAttribute('data-height', String(heightValue));
        } else {
          tableEl.style.removeProperty('height');
          tableEl.removeAttribute('data-height');
        }

        const classNames = new Set(baseClassNames);
        const ignored = new Set(['width', 'height']);
        Object.entries(attrs).forEach(([key, value]) => {
          if (ignored.has(key)) return;
          if (key === 'class') {
            if (value) {
              String(value)
                .split(/\s+/)
                .filter(Boolean)
                .forEach(className => classNames.add(className));
            }
            return;
          }
          if (value === false || value === null || value === undefined) {
            tableEl.removeAttribute(key);
          } else {
            tableEl.setAttribute(key, String(value));
          }
        });
        tableEl.className = Array.from(classNames).join(' ');
      };

      applyNodeAttributes(node.attrs);

      const focusAndSelect = () => {
        editor?.view?.focus?.();
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (typeof pos === 'number') {
            editor?.commands?.setNodeSelection?.(pos);
          }
        }
      };

      const pointerDownListener = event => {
        if (event.target?.closest?.('.resize-handle')) return;

        const targetTable = event.target === tableEl || tableEl.contains(event.target);
        if (!targetTable) return;

        const rect = tableEl.getBoundingClientRect();
        const tolerance = 6;
        const withinBounds =
          event.clientX >= rect.left - tolerance &&
          event.clientX <= rect.right + tolerance &&
          event.clientY >= rect.top - tolerance &&
          event.clientY <= rect.bottom + tolerance;
        if (!withinBounds) return;

        const nearHorizontalEdge =
          event.clientX <= rect.left + tolerance || event.clientX >= rect.right - tolerance;
        const nearVerticalEdge =
          event.clientY <= rect.top + tolerance || event.clientY >= rect.bottom - tolerance;
        const nearEdge = nearHorizontalEdge || nearVerticalEdge;

        if (nearEdge) {
          event.preventDefault();
          event.stopPropagation();
        }

        focusAndSelect();
      };

      const clickListener = event => {
        if (event.target?.closest?.('.resize-handle')) return;
        const targetTable = event.target === tableEl || tableEl.contains(event.target);
        if (!targetTable) return;
        event.preventDefault();
        event.stopPropagation();
        focusAndSelect();
      };

      container.addEventListener('pointerdown', pointerDownListener, true);
      container.addEventListener('click', clickListener, true);

      const applySize = (width, height) => {
        if (Number.isFinite(width)) {
          const rounded = Math.max(1, Math.round(width));
          tableEl.style.width = `${rounded}px`;
          tableEl.setAttribute('data-width', String(rounded));
        }
        if (Number.isFinite(height)) {
          const rounded = Math.max(1, Math.round(height));
          tableEl.style.height = `${rounded}px`;
          tableEl.setAttribute('data-height', String(rounded));
        }
      };

      const commitSize = (width, height) => {
        if (!editor?.view) return;
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (typeof pos !== 'number') return;
        const current = editor.view.state.doc.nodeAt(pos);
        if (!current) return;

        const attrs = { ...current.attrs };
        const maxEditorWidth = getEditorContentWidth(editor);
        const constrained = clampDimensionsToConstraints(width, height, constraints, maxEditorWidth);
        attrs.width = constrained.width;
        attrs.height = constrained.height;
        const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, attrs);
        editor.view.dispatch(tr);
      };

      const validateAndCommitDimensions = () => {
        const widthAttr = parseDimension(currentNode.attrs.width);
        const heightAttr = parseDimension(currentNode.attrs.height);
        const maxEditorWidth = getEditorContentWidth(editor);
        if (widthAttr !== null || heightAttr !== null) {
          const rect = tableEl.getBoundingClientRect();
          const constrained = clampDimensionsToConstraints(
            widthAttr ?? rect.width,
            heightAttr ?? rect.height,
            constraints,
            maxEditorWidth,
          );
          if (
            constrained.width !== (widthAttr ?? Math.round(rect.width)) ||
            constrained.height !== (heightAttr ?? Math.round(rect.height))
          ) {
            commitSize(constrained.width, constrained.height);
          }
          return;
        }
        const rect = tableEl.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          commitSize(rect.width, rect.height);
        }
      };

      const startResize = (event, direction) => {
        event.preventDefault();
        event.stopPropagation();
        focusAndSelect();

        const rect = tableEl.getBoundingClientRect();
        const initialWidth = Math.max(1, parseDimension(currentNode.attrs.width) ?? rect.width);
        const initialHeight = Math.max(1, parseDimension(currentNode.attrs.height) ?? rect.height);
        const affectsWidth = direction.includes('e') || direction.includes('w');
        const affectsHeight = direction.includes('n') || direction.includes('s');
        const startX = event.clientX;
        const startY = event.clientY;
        const maxEditorWidth = getEditorContentWidth(editor);
        let lastAppliedSize = { width: initialWidth, height: initialHeight };

        const applyFromDelta = (deltaX, deltaY) => {
          let nextWidth = initialWidth;
          let nextHeight = initialHeight;
          if (affectsWidth) {
            const sign = direction.includes('e') ? 1 : -1;
            nextWidth = initialWidth + sign * deltaX;
          }
          if (affectsHeight) {
            const sign = direction.includes('s') ? 1 : -1;
            nextHeight = initialHeight + sign * deltaY;
          }
          const constrained = clampDimensionsToConstraints(nextWidth, nextHeight, constraints, maxEditorWidth);
          applySize(constrained.width, constrained.height);
          lastAppliedSize = constrained;
        };

        const pointerId = event.pointerId;

        const handlePointerMove = moveEvent => {
          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;
          applyFromDelta(deltaX, deltaY);
        };

        const handlePointerUp = () => {
          if (pointerId && event.target?.releasePointerCapture) {
            try { event.target.releasePointerCapture(pointerId); } catch (error) {}
          }
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
          commitSize(lastAppliedSize.width, lastAppliedSize.height);
        };

        if (pointerId && event.target?.setPointerCapture) {
          try { event.target.setPointerCapture(pointerId); } catch (error) {}
        }

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
      };

      DIRECTIONS.forEach(direction => {
        const handle = document.createElement('div');
        handle.classList.add('resize-handle', `resize-handle-${direction}`);
        handle.addEventListener('pointerdown', e => startResize(e, direction));
        container.appendChild(handle);
      });

      if (tableEl instanceof HTMLElement && !tableEl.hasAttribute('role')) {
        tableEl.setAttribute('role', 'grid');
      }

      window.requestAnimationFrame(() => validateAndCommitDimensions());

      return {
        dom: container,
        contentDOM: contentDom,
        selectNode: () => container.classList.add('is-selected'),
        deselectNode: () => container.classList.remove('is-selected'),
        update: updatedNode => {
          if (updatedNode.type !== currentNode.type) return false;
          currentNode = updatedNode;
          applyNodeAttributes(updatedNode.attrs);
          return true;
        },
        ignoreMutation: mutation => mutation.type === 'attributes' && mutation.target === tableEl,
        destroy: () => {
          container.removeEventListener('pointerdown', pointerDownListener, true);
          container.removeEventListener('click', clickListener, true);
        },
      };
    };
  },

  onCreate() {
    if (this.editor?.storage) {
      this.editor.storage.resizableTable = this.storage;
    }
  },

  onDestroy() {
    if (this.editor?.storage && this.editor.storage.resizableTable === this.storage) {
      delete this.editor.storage.resizableTable;
    }
  },
});

export default ResizableTable;
