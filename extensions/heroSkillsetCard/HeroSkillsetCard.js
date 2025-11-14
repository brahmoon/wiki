import { Node } from 'https://esm.sh/@tiptap/core';
import {
  loadHeroSkillsetData,
  getDefaultHeroSkillsetConfig,
  normalizeHeroSkillsetConfig,
  encodeHeroSkillsetConfig,
  ROW_KEYS,
  USER_SKILL_KEYS
} from '../../scripts/heroSkillsetService.js';

const HERO_BADGES = {
  hero: '英雄',
  skill1: '固定',
  skill2: '自由枠',
  skill3: '自由枠',
  skill4: '固定'
};

let selectionOverlayInstance = null;

function cloneConfig(config) {
  return normalizeHeroSkillsetConfig(config);
}

function createSlotFigure(image, label, placeholderText = '+') {
  const figure = document.createElement('div');
  figure.className = 'hero-skillset-slot__figure';
  if (image) {
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.alt || label || '';
    figure.appendChild(img);
  } else {
    const span = document.createElement('span');
    span.className = 'hero-skillset-slot__placeholder';
    span.textContent = placeholderText;
    figure.appendChild(span);
  }
  return figure;
}

function createHeroSlotButton(rowKey, hero) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hero-skillset-slot hero-skillset-slot--hero';
  button.dataset.heroSlot = 'true';
  button.dataset.row = rowKey;
  button.setAttribute('aria-label', hero ? `${hero.name} を変更` : '英雄を選択');
  const badge = document.createElement('span');
  badge.className = 'hero-skillset-slot__badge';
  badge.textContent = HERO_BADGES.hero;
  const figure = createSlotFigure(hero ? { src: hero.image, alt: hero.name } : null, hero?.name || '', '+');
  const label = document.createElement('span');
  label.className = 'hero-skillset-slot__label';
  label.textContent = hero?.name || '英雄を選択';
  if (!hero) {
    button.classList.add('is-empty');
  }
  button.append(badge, figure, label);
  return button;
}

function createSkillSlotElement({ rowKey, slotKey, skill, editable }) {
  const element = document.createElement(editable ? 'button' : 'div');
  if (editable) {
    element.type = 'button';
    element.dataset.skillSlot = slotKey;
    element.dataset.row = rowKey;
    element.setAttribute('aria-label', skill ? `${skill.name} を変更` : 'スキルを選択');
  }
  element.className = `hero-skillset-slot hero-skillset-slot--skill ${editable ? 'hero-skillset-slot--editable' : 'hero-skillset-slot--fixed'}`;
  const badge = document.createElement('span');
  badge.className = 'hero-skillset-slot__badge';
  badge.textContent = HERO_BADGES[slotKey] || '';
  const figure = createSlotFigure(skill ? { src: skill.image, alt: skill.name } : null, skill?.name || '', editable ? '+' : '—');
  const label = document.createElement('span');
  label.className = 'hero-skillset-slot__label';
  if (skill) {
    label.textContent = skill.name;
  } else if (editable) {
    label.textContent = 'スキルを選択';
    element.classList.add('is-empty');
  } else {
    label.textContent = '英雄未選択';
    element.classList.add('is-empty');
  }
  element.append(badge, figure, label);
  return element;
}

function getSelectionOverlay() {
  if (selectionOverlayInstance) {
    return selectionOverlayInstance;
  }
  const overlay = document.createElement('div');
  overlay.className = 'hero-skillset-overlay';
  const panel = document.createElement('div');
  panel.className = 'hero-skillset-overlay__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const title = document.createElement('h3');
  title.className = 'hero-skillset-overlay__title';
  const message = document.createElement('div');
  message.className = 'hero-skillset-overlay__message';
  const grid = document.createElement('div');
  grid.className = 'hero-skillset-overlay__grid';
  const footer = document.createElement('div');
  footer.className = 'hero-skillset-overlay__footer';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'hero-skillset-overlay__close';
  closeButton.textContent = '閉じる';
  footer.appendChild(closeButton);
  panel.append(title, message, grid, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function hide() {
    overlay.classList.remove('is-visible');
    grid.innerHTML = '';
    message.textContent = '';
  }

  closeButton.addEventListener('click', hide);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      hide();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay.classList.contains('is-visible')) {
      hide();
    }
  });

  selectionOverlayInstance = {
    open({ title: overlayTitle, items, allowClear, onSelect, onClear, emptyMessage }) {
      title.textContent = overlayTitle || '';
      grid.innerHTML = '';
      message.textContent = '';
      if (allowClear) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'hero-skillset-overlay__clear';
        clearButton.textContent = '選択を解除';
        clearButton.addEventListener('click', () => {
          onClear?.();
          hide();
        }, { once: true });
        grid.appendChild(clearButton);
      }
      if (!items.length) {
        message.textContent = emptyMessage || '選択肢がありません。';
      } else {
        items.forEach(item => {
          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'hero-skillset-overlay__option';
          const imgWrapper = document.createElement('div');
          imgWrapper.className = 'hero-skillset-overlay__option-figure';
          if (item.image) {
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.name || '';
            imgWrapper.appendChild(img);
          }
          const label = document.createElement('div');
          label.className = 'hero-skillset-overlay__option-label';
          label.textContent = item.name || '';
          option.append(imgWrapper, label);
          if (item.description) {
            const desc = document.createElement('div');
            desc.className = 'hero-skillset-overlay__option-description';
            desc.textContent = item.description;
            option.appendChild(desc);
          }
          option.addEventListener('click', () => {
            onSelect?.(item.id);
            hide();
          }, { once: true });
          grid.appendChild(option);
        });
      }
      overlay.classList.add('is-visible');
    }
  };
  return selectionOverlayInstance;
}

class HeroSkillsetCardNodeView {
  constructor(node, editor, getPos) {
    this.node = node;
    this.editor = editor;
    this.getPos = getPos;
    this.config = cloneConfig(node.attrs.configuration);
    this.serializedConfig = encodeHeroSkillsetConfig(this.config);
    this.dom = document.createElement('div');
    this.dom.className = 'hero-skillset-card hero-skillset-card--editing';
    this.dom.setAttribute('data-hero-skillset-card', '');
    this.dom.setAttribute('data-config', this.serializedConfig);
    this.dom.contentEditable = 'false';
    this.body = document.createElement('div');
    this.body.className = 'hero-skillset-card__body';
    this.dom.appendChild(this.body);
    this.handleClick = this.handleClick.bind(this);
    this.dom.addEventListener('click', this.handleClick);
    this.render();
    void this.loadData();
  }

  async loadData() {
    try {
      this.data = await loadHeroSkillsetData();
      this.render();
    } catch (error) {
      console.error('英雄・スキルデータの読み込みに失敗しました。', error);
      this.body.innerHTML = '<div class="hero-skillset-card__status hero-skillset-card__status--error">データを読み込めませんでした。</div>';
    }
  }

  handleClick(event) {
    const heroSlot = event.target.closest('[data-hero-slot]');
    if (heroSlot) {
      const rowKey = heroSlot.dataset.row;
      if (rowKey) {
        event.preventDefault();
        this.openHeroPicker(rowKey);
      }
      return;
    }
    const skillSlot = event.target.closest('[data-skill-slot]');
    if (skillSlot) {
      const rowKey = skillSlot.dataset.row;
      const slotKey = skillSlot.dataset.skillSlot;
      if (rowKey && slotKey) {
        event.preventDefault();
        this.openSkillPicker(rowKey, slotKey);
      }
    }
  }

  openHeroPicker(rowKey) {
    if (!this.data) {
      return;
    }
    const overlay = getSelectionOverlay();
    const currentHeroId = this.config.rows[rowKey]?.heroId || null;
    const disallowed = ROW_KEYS.filter(key => key !== rowKey)
      .map(key => this.config.rows[key]?.heroId)
      .filter(Boolean);
    const items = this.data.heroes.filter(hero => {
      if (!hero?.id) {
        return false;
      }
      if (hero.id === currentHeroId) {
        return true;
      }
      return !disallowed.includes(hero.id);
    }).map(hero => ({
      id: hero.id,
      name: hero.name,
      image: hero.image,
      description: hero.description
    }));
    overlay.open({
      title: '英雄を選択',
      items,
      allowClear: Boolean(currentHeroId),
      onSelect: heroId => this.setHero(rowKey, heroId),
      onClear: () => this.clearHero(rowKey),
      emptyMessage: '選択できる英雄がありません。'
    });
  }

  openSkillPicker(rowKey, slotKey) {
    if (!this.data || !USER_SKILL_KEYS.includes(slotKey)) {
      return;
    }
    const overlay = getSelectionOverlay();
    const currentSkillId = this.config.rows[rowKey]?.userSkills?.[slotKey] || null;
    const usedIds = [];
    ROW_KEYS.forEach(row => {
      USER_SKILL_KEYS.forEach(key => {
        const id = this.config.rows[row]?.userSkills?.[key];
        if (id && (row !== rowKey || key !== slotKey)) {
          usedIds.push(id);
        }
      });
    });
    const items = this.data.selectableSkills.filter(skill => {
      if (!skill?.id) {
        return false;
      }
      if (skill.id === currentSkillId) {
        return true;
      }
      return !usedIds.includes(skill.id);
    }).map(skill => ({
      id: skill.id,
      name: skill.name,
      image: skill.image,
      description: skill.description
    }));
    overlay.open({
      title: 'スキルを選択',
      items,
      allowClear: Boolean(currentSkillId),
      onSelect: skillId => this.setUserSkill(rowKey, slotKey, skillId),
      onClear: () => this.clearUserSkill(rowKey, slotKey),
      emptyMessage: '選択できるスキルがありません。'
    });
  }

  setHero(rowKey, heroId) {
    const next = cloneConfig(this.config);
    if (!next.rows[rowKey]) {
      next.rows[rowKey] = { heroId: null, userSkills: { skill2: null, skill3: null } };
    }
    next.rows[rowKey].heroId = heroId;
    this.persistConfig(next);
  }

  clearHero(rowKey) {
    const next = cloneConfig(this.config);
    if (!next.rows[rowKey]) {
      return;
    }
    next.rows[rowKey].heroId = null;
    this.persistConfig(next);
  }

  setUserSkill(rowKey, slotKey, skillId) {
    const next = cloneConfig(this.config);
    if (!next.rows[rowKey]) {
      next.rows[rowKey] = { heroId: null, userSkills: { skill2: null, skill3: null } };
    }
    next.rows[rowKey].userSkills[slotKey] = skillId;
    this.persistConfig(next);
  }

  clearUserSkill(rowKey, slotKey) {
    const next = cloneConfig(this.config);
    if (!next.rows[rowKey]) {
      return;
    }
    next.rows[rowKey].userSkills[slotKey] = null;
    this.persistConfig(next);
  }

  persistConfig(nextConfig) {
    const serialized = encodeHeroSkillsetConfig(nextConfig);
    if (serialized === this.serializedConfig) {
      return;
    }
    this.config = nextConfig;
    this.serializedConfig = serialized;
    this.render();
    const pos = typeof this.getPos === 'function' ? this.getPos() : null;
    if (typeof pos !== 'number') {
      return;
    }
    const { state, dispatch } = this.editor.view;
    const transaction = state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      configuration: serialized
    });
    dispatch(transaction);
  }

  render() {
    this.dom.setAttribute('data-config', this.serializedConfig);
    if (!this.data) {
      this.body.innerHTML = '<div class="hero-skillset-card__status">英雄・スキルデータを読み込み中...</div>';
      return;
    }
    this.body.innerHTML = '';
    ROW_KEYS.forEach((rowKey, index) => {
      const heroId = this.config.rows[rowKey]?.heroId || null;
      const hero = heroId ? this.data.heroMap.get(heroId) : null;
      const fixedSkills = hero?.fixedSkillIds || [];
      const fixed1 = fixedSkills[0] ? this.data.skillMap.get(fixedSkills[0]) : null;
      const fixed4 = fixedSkills[1] ? this.data.skillMap.get(fixedSkills[1]) : null;
      const userSkill2Id = this.config.rows[rowKey]?.userSkills?.skill2 || null;
      const userSkill3Id = this.config.rows[rowKey]?.userSkills?.skill3 || null;
      const userSkill2 = userSkill2Id ? this.data.skillMap.get(userSkill2Id) : null;
      const userSkill3 = userSkill3Id ? this.data.skillMap.get(userSkill3Id) : null;
      const row = document.createElement('div');
      row.className = 'hero-skillset-card__row';
      row.dataset.row = rowKey;
      row.setAttribute('data-hero-row', String(index + 1));
      const heading = document.createElement('div');
      heading.className = 'hero-skillset-card__row-heading';
      heading.textContent = `部隊${index + 1}`;
      const content = document.createElement('div');
      content.className = 'hero-skillset-card__row-content';
      const heroSlot = createHeroSlotButton(rowKey, hero);
      heroSlot.dataset.heroSlot = 'true';
      content.appendChild(heroSlot);
      const skills = document.createElement('div');
      skills.className = 'hero-skillset-card__skills';
      const skill1 = createSkillSlotElement({ rowKey, slotKey: 'skill1', skill: fixed1, editable: false });
      skill1.dataset.heroSlot = 'fixed';
      const skill2 = createSkillSlotElement({ rowKey, slotKey: 'skill2', skill: userSkill2, editable: true });
      skill2.dataset.skillSlot = 'skill2';
      const skill3 = createSkillSlotElement({ rowKey, slotKey: 'skill3', skill: userSkill3, editable: true });
      skill3.dataset.skillSlot = 'skill3';
      const skill4 = createSkillSlotElement({ rowKey, slotKey: 'skill4', skill: fixed4, editable: false });
      skill4.dataset.heroSlot = 'fixed';
      skills.append(skill1, skill2, skill3, skill4);
      content.appendChild(skills);
      row.append(heading, content);
      this.body.appendChild(row);
    });
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false;
    }
    this.node = node;
    const nextConfig = cloneConfig(node.attrs.configuration);
    const serialized = encodeHeroSkillsetConfig(nextConfig);
    if (serialized !== this.serializedConfig) {
      this.config = nextConfig;
      this.serializedConfig = serialized;
      this.render();
    }
    return true;
  }

  destroy() {
    this.dom.removeEventListener('click', this.handleClick);
  }
}

export const HeroSkillsetCard = Node.create({
  name: 'heroSkillsetCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      configuration: {
        default: encodeHeroSkillsetConfig(getDefaultHeroSkillsetConfig())
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-hero-skillset-card]',
        priority: 1000,
        getAttrs: dom => {
          if (!(dom instanceof HTMLElement)) {
            return false;
          }
          const config = dom.getAttribute('data-config') || null;
          return { configuration: config };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = {
      class: 'hero-skillset-card hero-skillset-card--view',
      'data-hero-skillset-card': '',
      'data-config': HTMLAttributes.configuration
        ? encodeHeroSkillsetConfig(HTMLAttributes.configuration)
        : encodeHeroSkillsetConfig(getDefaultHeroSkillsetConfig())
    };
    return ['div', attrs, ['div', { class: 'hero-skillset-card__placeholder' }, '英雄スキル構成カード']];
  },
  addCommands() {
    return {
      insertHeroSkillsetCard: () => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: {
            configuration: encodeHeroSkillsetConfig(getDefaultHeroSkillsetConfig())
          }
        });
      }
    };
  },
  addNodeView() {
    return ({ node, editor, getPos }) => new HeroSkillsetCardNodeView(node, editor, getPos);
  }
});
