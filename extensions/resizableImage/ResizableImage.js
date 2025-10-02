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
  let minShortSide = toNumberOrNull(constraints.minShortSide);
  let maxLongSide = toNumberOrNull(constraints.maxLongSide);

  if (minShortSide !== null) {
    minShortSide = Math.max(1, Math.round(minShortSide));
  }

  if (maxLongSide !== null) {
    maxLongSide = Math.max(1, Math.round(maxLongSide));
  }

  if (minShortSide !== null && maxLongSide !== null && minShortSide > maxLongSide) {
    minShortSide = maxLongSide;
  }

  return {
    minShortSide,
    maxLongSide,
  };
};

const getEditorContentWidth = editor => {
  const editorDom = editor?.view?.dom;
  if (!editorDom) {
    return null;
  }

  const rect = editorDom.getBoundingClientRect();
  const styles = window.getComputedStyle(editorDom);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const width = rect.width - paddingLeft - paddingRight;
  return Number.isFinite(width) && width > 0 ? width : null;
};

const parseDimension = value => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampDimensionsToConstraints = (width, height, constraints, maxEditorWidth) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const safeConstraints = constraints || {};
  const baseShortSide = Math.min(width, height);
  const baseLongSide = Math.max(width, height);

  let minScale = 0;
  let maxScale = Number.POSITIVE_INFINITY;

  if (safeConstraints.minShortSide && baseShortSide > 0) {
    minScale = Math.max(minScale, safeConstraints.minShortSide / baseShortSide);
  }

  if (safeConstraints.maxLongSide && baseLongSide > 0) {
    maxScale = Math.min(maxScale, safeConstraints.maxLongSide / baseLongSide);
  }

  if (maxEditorWidth && width > 0) {
    maxScale = Math.min(maxScale, maxEditorWidth / width);
  }

  if (!Number.isFinite(minScale) || minScale < 0) {
    minScale = 0;
  }

  if (!Number.isFinite(maxScale) || maxScale <= 0) {
    maxScale = Number.POSITIVE_INFINITY;
  }

  if (minScale > maxScale) {
    minScale = maxScale;
  }

  let scale = 1;

  if (scale < minScale) {
    scale = minScale;
  }

  if (scale > maxScale) {
    scale = maxScale;
  }

  if (!Number.isFinite(scale) || scale <= 0) {
    scale = 1;
  }

  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));

  return { width: nextWidth, height: nextHeight };
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
        minShortSide: 160,
        maxLongSide: 960,
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
        const hasWidth = width !== undefined;
        const hasHeight = height !== undefined;

        if (!hasWidth && !hasHeight) {
          return true;
        }

        let transaction = tr;
        let changed = false;
        const from = state.selection.from;
        const to = state.selection.to;
        const constraints = this.storage.constraints || {};
        const maxEditorWidth = getEditorContentWidth(this.editor);

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type !== this.type) {
            return true;
          }

          const attrs = { ...node.attrs };
          const currentWidth = parseDimension(attrs.width);
          const currentHeight = parseDimension(attrs.height);

          let targetWidth = hasWidth ? (width === null ? null : Number(width)) : currentWidth;
          let targetHeight = hasHeight ? (height === null ? null : Number(height)) : currentHeight;

          if (targetWidth !== null && !Number.isFinite(targetWidth)) {
            targetWidth = currentWidth;
          }
          if (targetHeight !== null && !Number.isFinite(targetHeight)) {
            targetHeight = currentHeight;
          }

          if (targetWidth === null && targetHeight === null) {
            return true;
          }

          const hasCurrentDimensions = Number.isFinite(currentWidth) && Number.isFinite(currentHeight) && currentHeight > 0;
          let aspectRatio = hasCurrentDimensions ? currentWidth / currentHeight : null;

          if (!aspectRatio && Number.isFinite(targetWidth) && Number.isFinite(targetHeight) && targetHeight > 0) {
            aspectRatio = targetWidth / targetHeight;
          }

          if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
            aspectRatio = 1;
          }

          if (hasWidth && !hasHeight && Number.isFinite(targetWidth)) {
            targetHeight = targetWidth / aspectRatio;
          }

          if (hasHeight && !hasWidth && Number.isFinite(targetHeight)) {
            targetWidth = targetHeight * aspectRatio;
          }

          if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
            return true;
          }

          const constrained = clampDimensionsToConstraints(targetWidth, targetHeight, constraints, maxEditorWidth);
          if (!constrained) {
            return true;
          }

          const { width: nextWidth, height: nextHeight } = constrained;

          const previousWidth = Number.isFinite(currentWidth) ? Math.round(currentWidth) : null;
          const previousHeight = Number.isFinite(currentHeight) ? Math.round(currentHeight) : null;

          if (previousWidth === nextWidth && previousHeight === nextHeight) {
            return true;
          }

          attrs.width = nextWidth;
          attrs.height = nextHeight;

          transaction = transaction.setNodeMarkup(pos, undefined, attrs);
          changed = true;
          return false;
        });

        if (changed && dispatch) {
          dispatch(transaction);
        }

        return changed;
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
        if (width === null || width === undefined) {
          imageEl.style.removeProperty('width');
          imageEl.removeAttribute('width');
        } else {
          const roundedWidth = Math.max(1, Math.round(width));
          imageEl.style.width = `${roundedWidth}px`;
          imageEl.setAttribute('width', String(roundedWidth));
        }

        if (height === null || height === undefined) {
          imageEl.style.removeProperty('height');
          imageEl.removeAttribute('height');
        } else {
          const roundedHeight = Math.max(1, Math.round(height));
          imageEl.style.height = `${roundedHeight}px`;
          imageEl.setAttribute('height', String(roundedHeight));
        }
      };

      const commitSize = (width, height) => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (typeof pos !== 'number' || !editor?.view) {
          return;
        }

        const current = editor.view.state.doc.nodeAt(pos);
        if (!current) {
          return;
        }

        const attrs = { ...current.attrs };
        const previousWidth = parseDimension(attrs.width);
        const previousHeight = parseDimension(attrs.height);

        let nextWidth = width === null ? null : Number(width);
        let nextHeight = height === null ? null : Number(height);

        const constraints = getConstraints();
        const maxEditorWidth = getEditorContentWidth(editor);

        if (Number.isFinite(nextWidth) && Number.isFinite(nextHeight)) {
          const constrained = clampDimensionsToConstraints(nextWidth, nextHeight, constraints, maxEditorWidth);
          if (constrained) {
            nextWidth = constrained.width;
            nextHeight = constrained.height;
          }
        }

        if (nextWidth !== null && (!Number.isFinite(nextWidth) || nextWidth <= 0)) {
          nextWidth = previousWidth;
        }

        if (nextHeight !== null && (!Number.isFinite(nextHeight) || nextHeight <= 0)) {
          nextHeight = previousHeight;
        }

        nextWidth = nextWidth === null ? null : Math.max(1, Math.round(nextWidth));
        nextHeight = nextHeight === null ? null : Math.max(1, Math.round(nextHeight));

        if (nextWidth === previousWidth && nextHeight === previousHeight) {
          return;
        }

        attrs.width = nextWidth;
        attrs.height = nextHeight;

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
        const initialWidth = Math.max(1, parseDimension(currentNode.attrs.width) ?? rect.width);
        const initialHeight = Math.max(1, parseDimension(currentNode.attrs.height) ?? rect.height);
        const affectsWidth = direction.includes('e') || direction.includes('w');
        const affectsHeight = direction.includes('n') || direction.includes('s');
        const startX = event.clientX;
        const startY = event.clientY;
        const constraints = getConstraints();
        const maxEditorWidth = getEditorContentWidth(editor);
        const baseShortSide = Math.min(initialWidth, initialHeight);
        const baseLongSide = Math.max(initialWidth, initialHeight);
        const minScale = constraints.minShortSide && baseShortSide > 0
          ? constraints.minShortSide / baseShortSide
          : null;
        const maxScaleFromConstraints = constraints.maxLongSide && baseLongSide > 0
          ? constraints.maxLongSide / baseLongSide
          : null;
        const maxScaleFromEditor = maxEditorWidth && initialWidth > 0
          ? maxEditorWidth / initialWidth
          : null;

        let latestScale = 1;

        const clampScale = value => {
          let scale = Number.isFinite(value) ? value : latestScale;
          if (!Number.isFinite(scale) || scale <= 0) {
            scale = latestScale;
          }

          const finiteMinScale = minScale && Number.isFinite(minScale) ? minScale : null;
          const finiteMaxConstraint = maxScaleFromConstraints && Number.isFinite(maxScaleFromConstraints)
            ? maxScaleFromConstraints
            : null;
          const finiteMaxEditor = maxScaleFromEditor && Number.isFinite(maxScaleFromEditor)
            ? maxScaleFromEditor
            : null;

          if (finiteMinScale !== null) {
            scale = Math.max(scale, finiteMinScale);
          }

          if (finiteMaxConstraint !== null) {
            scale = Math.min(scale, finiteMaxConstraint);
          }

          if (finiteMaxEditor !== null) {
            scale = Math.min(scale, finiteMaxEditor);
          }

          if (finiteMaxEditor !== null && finiteMinScale !== null && finiteMinScale > finiteMaxEditor) {
            scale = finiteMaxEditor;
          }

          return Math.max(0.01, scale);
        };

        const updateScale = scaleValue => {
          latestScale = clampScale(scaleValue);
          const nextWidth = initialWidth * latestScale;
          const nextHeight = initialHeight * latestScale;
          applySize(nextWidth, nextHeight);
        };

        const pointerId = event.pointerId;

        const handlePointerMove = moveEvent => {
          moveEvent.preventDefault();

          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;

          const scaleCandidates = [];

          if (affectsWidth && initialWidth > 0) {
            const sign = direction.includes('e') ? 1 : -1;
            const widthScale = (initialWidth + sign * deltaX) / initialWidth;
            if (Number.isFinite(widthScale) && widthScale > 0) {
              scaleCandidates.push(widthScale);
            }
          }

          if (affectsHeight && initialHeight > 0) {
            const sign = direction.includes('s') ? 1 : -1;
            const heightScale = (initialHeight + sign * deltaY) / initialHeight;
            if (Number.isFinite(heightScale) && heightScale > 0) {
              scaleCandidates.push(heightScale);
            }
          }

          if (!scaleCandidates.length) {
            return;
          }

          let chosenScale = scaleCandidates[0];
          let largestDelta = Math.abs(chosenScale - 1);

          for (let index = 1; index < scaleCandidates.length; index += 1) {
            const candidate = scaleCandidates[index];
            const diff = Math.abs(candidate - 1);
            if (diff > largestDelta) {
              chosenScale = candidate;
              largestDelta = diff;
            }
          }

          updateScale(chosenScale);
        };

        const handlePointerUp = () => {
          if (pointerId !== undefined && event.target?.releasePointerCapture) {
            try {
              event.target.releasePointerCapture(pointerId);
            } catch (error) {
              // ignore
            }
          }

          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
          window.removeEventListener('pointercancel', handlePointerUp);

          const finalWidth = initialWidth * latestScale;
          const finalHeight = initialHeight * latestScale;
          commitSize(finalWidth, finalHeight);
        };

        if (pointerId !== undefined && event.target?.setPointerCapture) {
          try {
            event.target.setPointerCapture(pointerId);
          } catch (error) {
            // ignore
          }
        }

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        updateScale(1);
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
