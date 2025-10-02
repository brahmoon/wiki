import { Image } from 'https://esm.sh/@tiptap/extension-image';

const DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

const toNumberOrNull = value => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return number;
};

const sanitizeConstraints = (constraints = {}) => {
  let minWidth = toNumberOrNull(constraints.minWidth);
  let maxWidth = toNumberOrNull(constraints.maxWidth);
  let minHeight = toNumberOrNull(constraints.minHeight);
  let maxHeight = toNumberOrNull(constraints.maxHeight);

  if (minWidth !== null) {
    minWidth = Math.max(1, Math.round(minWidth));
  }
  if (maxWidth !== null) {
    maxWidth = Math.max(1, Math.round(maxWidth));
  }
  if (minHeight !== null) {
    minHeight = Math.max(1, Math.round(minHeight));
  }
  if (maxHeight !== null) {
    maxHeight = Math.max(1, Math.round(maxHeight));
  }

  if (minWidth !== null && maxWidth !== null && minWidth > maxWidth) {
    [minWidth, maxWidth] = [maxWidth, minWidth];
  }

  if (minHeight !== null && maxHeight !== null && minHeight > maxHeight) {
    [minHeight, maxHeight] = [maxHeight, minHeight];
  }

  return {
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
  };
};

const clampWithBounds = (value, min, max) => {
  if (value === null || value === undefined) {
    return null;
  }

  let result = value;
  if (min !== null && min !== undefined) {
    result = Math.max(min, result);
  }
  if (max !== null && max !== undefined) {
    result = Math.min(max, result);
  }

  return Math.max(1, result);
};

const parseDimension = value => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const ResizableImage = Image.extend({
  name: 'image',

  addOptions() {
    const parentOptions = typeof Image.config.addOptions === 'function'
      ? Image.config.addOptions.call(this)
      : {};

    return {
      ...parentOptions,
      resizeConstraints: {
        minWidth: null,
        maxWidth: null,
        minHeight: null,
        maxHeight: null,
      },
    };
  },

  addStorage() {
    return {
      constraints: sanitizeConstraints(this.options.resizeConstraints || {}),
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => parseDimension(element.getAttribute('width')),
        renderHTML: attributes => {
          if (!attributes.width) {
            return {};
          }
          return { width: String(attributes.width) };
        },
      },
      height: {
        default: null,
        parseHTML: element => parseDimension(element.getAttribute('height')),
        renderHTML: attributes => {
          if (!attributes.height) {
            return {};
          }
          return { height: String(attributes.height) };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageSize: options => ({ tr, state, dispatch }) => {
        const { width, height } = options || {};
        const { constraints } = this.storage;
        const hasWidth = width !== undefined;
        const hasHeight = height !== undefined;

        if (!hasWidth && !hasHeight) {
          return true;
        }

        let transaction = tr;
        let changed = false;
        const from = state.selection.from;
        const to = state.selection.to;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type !== this.type) {
            return true;
          }

          const attrs = { ...node.attrs };

          if (hasWidth) {
            const parsedWidth = width === null ? null : Number(width);
            if (parsedWidth === null || Number.isFinite(parsedWidth)) {
              attrs.width = parsedWidth === null
                ? null
                : Math.round(clampWithBounds(parsedWidth, constraints.minWidth, constraints.maxWidth));
            }
          }

          if (hasHeight) {
            const parsedHeight = height === null ? null : Number(height);
            if (parsedHeight === null || Number.isFinite(parsedHeight)) {
              attrs.height = parsedHeight === null
                ? null
                : Math.round(clampWithBounds(parsedHeight, constraints.minHeight, constraints.maxHeight));
            }
          }

          transaction = transaction.setNodeMarkup(pos, undefined, attrs);
          changed = true;
          return false;
        });

        if (changed && dispatch) {
          dispatch(transaction);
        }

        return changed;
      },
      setImageResizeConstraints: constraints => ({ state, dispatch }) => {
        const existing = this.storage.constraints || {};
        const updated = { ...existing };
        const keys = ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'];

        keys.forEach(key => {
          if (constraints && Object.prototype.hasOwnProperty.call(constraints, key)) {
            updated[key] = constraints[key];
          }
        });

        const previous = this.storage.constraints || {};
        const sanitized = sanitizeConstraints(updated);
        const changed = keys.some(key => sanitized[key] !== previous[key]);

        this.storage.constraints = sanitized;

        if (dispatch && changed) {
          const tr = state.tr.setMeta('resizableImageConstraints', this.storage.constraints);
          tr.setMeta('addToHistory', false);
          dispatch(tr);
        }

        return true;
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      const container = document.createElement('span');
      container.classList.add('resizable-image');
      container.style.position = 'relative';
      container.style.display = 'inline-block';

      const imageEl = document.createElement('img');
      imageEl.draggable = false;

      const applyOptionAttributes = () => {
        const attrs = this.options.HTMLAttributes || {};
        Object.entries(attrs).forEach(([key, value]) => {
          if (value === false || value === null || value === undefined) {
            imageEl.removeAttribute(key);
          } else {
            imageEl.setAttribute(key, value);
          }
        });
      };

      applyOptionAttributes();
      container.appendChild(imageEl);

      const getConstraints = () => this.storage.constraints || {};

      const applyNodeAttributes = attrs => {
        if (attrs.src && imageEl.getAttribute('src') !== attrs.src) {
          imageEl.setAttribute('src', attrs.src);
        }

        if (attrs.alt !== undefined) {
          if (attrs.alt === null) {
            imageEl.removeAttribute('alt');
          } else {
            imageEl.setAttribute('alt', attrs.alt);
          }
        }

        if (attrs.title !== undefined) {
          if (attrs.title === null) {
            imageEl.removeAttribute('title');
          } else {
            imageEl.setAttribute('title', attrs.title);
          }
        }

        const widthValue = parseDimension(attrs.width);
        const heightValue = parseDimension(attrs.height);

        if (widthValue !== null) {
          imageEl.style.width = `${widthValue}px`;
          imageEl.setAttribute('width', String(widthValue));
        } else {
          imageEl.style.removeProperty('width');
          imageEl.removeAttribute('width');
        }

        if (heightValue !== null) {
          imageEl.style.height = `${heightValue}px`;
          imageEl.setAttribute('height', String(heightValue));
        } else {
          imageEl.style.removeProperty('height');
          imageEl.removeAttribute('height');
        }

        const ignoredKeys = new Set(['src', 'alt', 'title', 'width', 'height']);
        Object.entries(attrs).forEach(([key, value]) => {
          if (ignoredKeys.has(key)) {
            return;
          }

          if (value === null || value === undefined || value === false) {
            imageEl.removeAttribute(key);
          } else {
            imageEl.setAttribute(key, String(value));
          }
        });
      };

      applyNodeAttributes(node.attrs);

      const applySize = (width, height) => {
        if (width !== undefined) {
          if (width === null) {
            imageEl.style.removeProperty('width');
            imageEl.removeAttribute('width');
          } else {
            imageEl.style.width = `${width}px`;
            imageEl.setAttribute('width', String(Math.round(width)));
          }
        }

        if (height !== undefined) {
          if (height === null) {
            imageEl.style.removeProperty('height');
            imageEl.removeAttribute('height');
          } else {
            imageEl.style.height = `${height}px`;
            imageEl.setAttribute('height', String(Math.round(height)));
          }
        }
      };

      const commitSize = (width, height, affectsWidth, affectsHeight) => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (typeof pos !== 'number' || !editor?.view) {
          return;
        }

        const current = editor.view.state.doc.nodeAt(pos);
        if (!current) {
          return;
        }

        const attrs = { ...current.attrs };
        let changed = false;

        if (affectsWidth) {
          const previous = parseDimension(attrs.width);
          const nextValue = width === null ? null : Math.round(width);
          if (nextValue !== previous) {
            attrs.width = nextValue;
            changed = true;
          }
        }

        if (affectsHeight) {
          const previous = parseDimension(attrs.height);
          const nextValue = height === null ? null : Math.round(height);
          if (nextValue !== previous) {
            attrs.height = nextValue;
            changed = true;
          }
        }

        if (!changed) {
          return;
        }

        const transaction = editor.view.state.tr.setNodeMarkup(pos, undefined, attrs);
        editor.view.dispatch(transaction);
      };

      const startResize = (event, direction) => {
        event.preventDefault();
        event.stopPropagation();

        editor?.view?.focus?.();
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (typeof pos === 'number') {
            editor?.commands?.setNodeSelection?.(pos);
          }
        }

        const rect = imageEl.getBoundingClientRect();
        const initialWidth = parseDimension(currentNode.attrs.width) ?? rect.width;
        const initialHeight = parseDimension(currentNode.attrs.height) ?? rect.height;
        const affectsWidth = direction.includes('e') || direction.includes('w');
        const affectsHeight = direction.includes('n') || direction.includes('s');
        const startX = event.clientX;
        const startY = event.clientY;
        const constraints = getConstraints();

        let latestWidth = initialWidth;
        let latestHeight = initialHeight;

        const pointerId = event.pointerId;

        const handlePointerMove = moveEvent => {
          moveEvent.preventDefault();

          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;

          let nextWidth = initialWidth;
          let nextHeight = initialHeight;

          if (affectsWidth) {
            if (direction.includes('e')) {
              nextWidth = initialWidth + deltaX;
            } else if (direction.includes('w')) {
              nextWidth = initialWidth - deltaX;
            }
            nextWidth = clampWithBounds(nextWidth, constraints.minWidth, constraints.maxWidth);
            latestWidth = nextWidth;
          }

          if (affectsHeight) {
            if (direction.includes('s')) {
              nextHeight = initialHeight + deltaY;
            } else if (direction.includes('n')) {
              nextHeight = initialHeight - deltaY;
            }
            nextHeight = clampWithBounds(nextHeight, constraints.minHeight, constraints.maxHeight);
            latestHeight = nextHeight;
          }

          applySize(
            affectsWidth ? latestWidth : parseDimension(currentNode.attrs.width),
            affectsHeight ? latestHeight : parseDimension(currentNode.attrs.height),
          );
        };

        const handlePointerUp = () => {
          if (pointerId !== undefined && event.target?.releasePointerCapture) {
            try {
              event.target.releasePointerCapture(pointerId);
            } catch (error) {
              // ignore release errors
            }
          }

          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
          window.removeEventListener('pointercancel', handlePointerUp);

          commitSize(
            affectsWidth ? latestWidth : parseDimension(currentNode.attrs.width),
            affectsHeight ? latestHeight : parseDimension(currentNode.attrs.height),
            affectsWidth,
            affectsHeight,
          );
        };

        if (pointerId !== undefined && event.target?.setPointerCapture) {
          try {
            event.target.setPointerCapture(pointerId);
          } catch (error) {
            // ignore capture errors
          }
        }

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
      };

      const handleEntries = [];

      DIRECTIONS.forEach(direction => {
        const handle = document.createElement('div');
        handle.classList.add('resize-handle', `resize-handle-${direction}`);
        const listener = event => startResize(event, direction);
        handle.addEventListener('pointerdown', listener);
        handleEntries.push({ handle, listener });
        container.appendChild(handle);
      });

      return {
        dom: container,
        selectNode: () => {
          container.classList.add('is-selected');
        },
        deselectNode: () => {
          container.classList.remove('is-selected');
        },
        update: updatedNode => {
          if (updatedNode.type !== currentNode.type) {
            return false;
          }

          currentNode = updatedNode;
          applyNodeAttributes(updatedNode.attrs);
          return true;
        },
        ignoreMutation: mutation => mutation.type === 'attributes' && mutation.target === imageEl,
        destroy: () => {
          handleEntries.forEach(({ handle, listener }) => {
            handle.removeEventListener('pointerdown', listener);
          });
        },
      };
    };
  },

  onCreate() {
    if (this.editor?.storage) {
      this.editor.storage.resizableImage = this.storage;
    }
  },

  onDestroy() {
    if (this.editor?.storage && this.editor.storage.resizableImage === this.storage) {
      delete this.editor.storage.resizableImage;
    }
  },
});

export default ResizableImage;
