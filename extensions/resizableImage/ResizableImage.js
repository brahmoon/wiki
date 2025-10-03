import { mergeAttributes } from 'https://esm.sh/@tiptap/core';
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

const sanitizeAspectRatio = value => {
  const ratio = Number(value);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return null;
  }
  return Math.round(ratio * 1_000_000) / 1_000_000;
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

  return { minShortSide, maxLongSide };
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
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

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

  if (!Number.isFinite(minScale) || minScale < 0) minScale = 0;
  if (!Number.isFinite(maxScale) || maxScale <= 0) maxScale = Number.POSITIVE_INFINITY;
  if (minScale > maxScale) minScale = maxScale;

  let scale = 1;
  if (scale < minScale) scale = minScale;
  if (scale > maxScale) scale = maxScale;
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const getAspectRatioFromNode = node => {
  if (!node || !node.attrs) return null;
  const stored = sanitizeAspectRatio(node.attrs.aspectRatio);
  if (stored) return stored;
  const widthAttr = parseDimension(node.attrs.width);
  const heightAttr = parseDimension(node.attrs.height);
  if (Number.isFinite(widthAttr) && Number.isFinite(heightAttr) && heightAttr > 0) {
    return sanitizeAspectRatio(widthAttr / heightAttr);
  }
  return null;
};

const assignAspectRatio = (attrs, ratio) => {
  const sanitized = sanitizeAspectRatio(ratio);
  if (!attrs) return;
  if (sanitized === null) {
    delete attrs.aspectRatio;
  } else {
    attrs.aspectRatio = sanitized;
  }
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
    return { constraints: sanitizeConstraints(this.options.resizeConstraints || {}) };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => parseDimension(el.getAttribute('width')),
        renderHTML: attrs => attrs.width ? { width: String(attrs.width) } : {},
      },
      height: {
        default: null,
        parseHTML: el => parseDimension(el.getAttribute('height')),
        renderHTML: attrs => attrs.height ? { height: String(attrs.height) } : {},
      },
      aspectRatio: {
        default: null,
        parseHTML: el => sanitizeAspectRatio(el.getAttribute('data-aspect-ratio')),
        renderHTML: attrs => {
          const ratio = sanitizeAspectRatio(attrs.aspectRatio);
          return ratio ? { 'data-aspect-ratio': String(ratio) } : {};
        },
      },
      href: {
        default: null,
        parseHTML: element => {
          const anchor = element.closest('a[href]');
          return anchor ? anchor.getAttribute('href') : null;
        },
        renderHTML: attrs => (attrs.href ? { href: attrs.href } : {}),
      },
      target: {
        default: null,
        parseHTML: element => {
          const anchor = element.closest('a[href]');
          return anchor ? anchor.getAttribute('target') : null;
        },
        renderHTML: attrs => (attrs.target ? { target: attrs.target } : {}),
      },
      rel: {
        default: null,
        parseHTML: element => {
          const anchor = element.closest('a[href]');
          return anchor ? anchor.getAttribute('rel') : null;
        },
        renderHTML: attrs => (attrs.rel ? { rel: attrs.rel } : {}),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { href, target, rel, ...rest } = HTMLAttributes;
    const image = ['img', mergeAttributes(this.options.HTMLAttributes, rest)];
    if (href) {
      const anchorAttrs = { href };
      if (target) anchorAttrs.target = target;
      if (rel) anchorAttrs.rel = rel;
      return ['a', anchorAttrs, image];
    }
    return image;
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageSize: options => ({ tr, state, dispatch }) => {
        const { width, height } = options || {};
        const hasWidth = width !== undefined;
        const hasHeight = height !== undefined;
        if (!hasWidth && !hasHeight) return true;

        let transaction = tr;
        let changed = false;
        const { from, to } = state.selection;
        const constraints = this.storage.constraints || {};
        const maxEditorWidth = getEditorContentWidth(this.editor);

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type !== this.type) return true;
          const attrs = { ...node.attrs };
          const currentWidth = parseDimension(attrs.width);
          const currentHeight = parseDimension(attrs.height);

          let targetWidth = hasWidth ? Number(width) : currentWidth;
          let targetHeight = hasHeight ? Number(height) : currentHeight;
          if (!Number.isFinite(targetWidth)) targetWidth = currentWidth;
          if (!Number.isFinite(targetHeight)) targetHeight = currentHeight;
          if (targetWidth === null && targetHeight === null) return true;

          let aspectRatio = getAspectRatioFromNode(node) || 1;
          if (Number.isFinite(targetWidth) && !Number.isFinite(targetHeight))
            targetHeight = targetWidth / aspectRatio;
          if (Number.isFinite(targetHeight) && !Number.isFinite(targetWidth))
            targetWidth = targetHeight * aspectRatio;

          if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight)) return true;

          const constrained = clampDimensionsToConstraints(targetWidth, targetHeight, constraints, maxEditorWidth);
          if (!constrained) return true;

          const nextAspectRatio = sanitizeAspectRatio(constrained.width / constrained.height);
          if (
            constrained.width === currentWidth &&
            constrained.height === currentHeight &&
            attrs.aspectRatio === nextAspectRatio
          ) return true;

          attrs.width = constrained.width;
          attrs.height = constrained.height;
          assignAspectRatio(attrs, nextAspectRatio);

          transaction = transaction.setNodeMarkup(pos, undefined, attrs);
          changed = true;
          return false;
        });

        if (changed && dispatch) dispatch(transaction);
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

      const linkWrapper = document.createElement('a');
      linkWrapper.classList.add('resizable-image-link');
      linkWrapper.style.display = 'inline-block';
      linkWrapper.style.lineHeight = '0';
      linkWrapper.setAttribute('draggable', 'false');

      const imageEl = document.createElement('img');
      imageEl.draggable = false;
      let loadListener = null;

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
      linkWrapper.appendChild(imageEl);
      container.appendChild(linkWrapper);

      const getConstraints = () => this.storage.constraints || {};

      const applyNodeAttributes = attrs => {
        if (attrs.src && imageEl.getAttribute('src') !== attrs.src) {
          imageEl.setAttribute('src', attrs.src);
        }
        if (attrs.alt !== undefined) {
          if (attrs.alt === null) imageEl.removeAttribute('alt');
          else imageEl.setAttribute('alt', attrs.alt);
        }
        if (attrs.title !== undefined) {
          if (attrs.title === null) imageEl.removeAttribute('title');
          else imageEl.setAttribute('title', attrs.title);
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

        const updateLinkAttributes = attrs => {
          const hrefValue = attrs.href ?? null;
          if (hrefValue) {
            linkWrapper.setAttribute('href', String(hrefValue));
            linkWrapper.classList.add('has-link');
          } else {
            linkWrapper.removeAttribute('href');
            linkWrapper.classList.remove('has-link');
          }

          if (attrs.target) linkWrapper.setAttribute('target', String(attrs.target));
          else linkWrapper.removeAttribute('target');

          if (attrs.rel) linkWrapper.setAttribute('rel', String(attrs.rel));
          else linkWrapper.removeAttribute('rel');
        };

        updateLinkAttributes(attrs);

        const ignored = new Set(['src', 'alt', 'title', 'width', 'height', 'aspectRatio', 'href', 'target', 'rel']);
        Object.entries(attrs).forEach(([k, v]) => {
          if (ignored.has(k)) return;
          if (v === null || v === undefined || v === false) imageEl.removeAttribute(k);
          else imageEl.setAttribute(k, String(v));
        });
      };
      applyNodeAttributes(node.attrs);

      const commitSize = (width, height) => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (typeof pos !== 'number' || !editor?.view) return;
        const current = editor.view.state.doc.nodeAt(pos);
        if (!current) return;

        const attrs = { ...current.attrs };
        let nextWidth = Number(width);
        let nextHeight = Number(height);
        const constraints = getConstraints();
        const maxEditorWidth = getEditorContentWidth(editor);

        if (Number.isFinite(nextWidth) && Number.isFinite(nextHeight)) {
          const constrained = clampDimensionsToConstraints(nextWidth, nextHeight, constraints, maxEditorWidth);
          if (constrained) {
            nextWidth = constrained.width;
            nextHeight = constrained.height;
          }
        }
        const nextAspectRatio = Number.isFinite(nextWidth) && Number.isFinite(nextHeight) && nextHeight
          ? sanitizeAspectRatio(nextWidth / nextHeight)
          : null;

        attrs.width = Math.max(1, Math.round(nextWidth));
        attrs.height = Math.max(1, Math.round(nextHeight));
        assignAspectRatio(attrs, nextAspectRatio);

        const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, attrs);
        editor.view.dispatch(tr);
      };

      const validateAndCommitDimensions = () => {
        const widthAttr = parseDimension(currentNode.attrs.width);
        const heightAttr = parseDimension(currentNode.attrs.height);
        const constraints = getConstraints();
        const maxEditorWidth = getEditorContentWidth(editor);
        if (Number.isFinite(widthAttr) && Number.isFinite(heightAttr)) {
          const constrained = clampDimensionsToConstraints(widthAttr, heightAttr, constraints, maxEditorWidth);
          if (constrained &&
              (constrained.width !== Math.round(widthAttr) || constrained.height !== Math.round(heightAttr))) {
            commitSize(constrained.width, constrained.height);
          }
          return;
        }
        if (imageEl.naturalWidth > 0 && imageEl.naturalHeight > 0) {
          commitSize(imageEl.naturalWidth, imageEl.naturalHeight);
          return;
        }
        const rect = imageEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          commitSize(rect.width, rect.height);
        }
      };
      if (imageEl.complete) validateAndCommitDimensions();
      else {
        loadListener = () => validateAndCommitDimensions();
        imageEl.addEventListener('load', loadListener);
      }

      const applySize = (width, height) => {
        if (width) {
          imageEl.style.width = `${Math.round(width)}px`;
          imageEl.setAttribute('width', String(Math.round(width)));
        }
        if (height) {
          imageEl.style.height = `${Math.round(height)}px`;
          imageEl.setAttribute('height', String(Math.round(height)));
        }
      };

      const startResize = (event, direction) => {
        event.preventDefault();
        event.stopPropagation();
        editor?.view?.focus?.();
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (typeof pos === 'number') editor?.commands?.setNodeSelection?.(pos);
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

        let latestScale = 1;
        const clampScale = v => {
          let scale = Number.isFinite(v) ? v : latestScale;
          if (!Number.isFinite(scale) || scale <= 0) scale = latestScale;
          return Math.max(0.01, scale);
        };
        const updateScale = scaleValue => {
          latestScale = clampScale(scaleValue);
          applySize(initialWidth * latestScale, initialHeight * latestScale);
        };

        const pointerId = event.pointerId;
        const handlePointerMove = moveEvent => {
          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;
          const scales = [];
          if (affectsWidth) {
            const sign = direction.includes('e') ? 1 : -1;
            scales.push((initialWidth + sign * deltaX) / initialWidth);
          }
          if (affectsHeight) {
            const sign = direction.includes('s') ? 1 : -1;
            scales.push((initialHeight + sign * deltaY) / initialHeight);
          }
          if (scales.length) updateScale(scales[0]);
        };
        const handlePointerUp = () => {
          if (pointerId && event.target?.releasePointerCapture) {
            try { event.target.releasePointerCapture(pointerId); } catch {}
          }
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
          commitSize(initialWidth * latestScale, initialHeight * latestScale);
        };

        if (pointerId && event.target?.setPointerCapture) {
          try { event.target.setPointerCapture(pointerId); } catch {}
        }
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        updateScale(1);
      };

      DIRECTIONS.forEach(direction => {
        const handle = document.createElement('div');
        handle.classList.add('resize-handle', `resize-handle-${direction}`);
        handle.addEventListener('pointerdown', e => startResize(e, direction));
        container.appendChild(handle);
      });

      return {
        dom: container,
        selectNode: () => container.classList.add('is-selected'),
        deselectNode: () => container.classList.remove('is-selected'),
        update: updatedNode => {
          if (updatedNode.type !== currentNode.type) return false;
          currentNode = updatedNode;
          applyNodeAttributes(updatedNode.attrs);
          validateAndCommitDimensions();
          return true;
        },
        ignoreMutation: m => m.type === 'attributes' && (m.target === imageEl || m.target === linkWrapper),
        destroy: () => {
          if (loadListener) imageEl.removeEventListener('load', loadListener);
        },
      };
    };
  },

  onCreate() {
    if (this.editor?.storage) this.editor.storage.resizableImage = this.storage;
  },
  onDestroy() {
    if (this.editor?.storage && this.editor.storage.resizableImage === this.storage)
      delete this.editor.storage.resizableImage;
  },
});

export default ResizableImage;
