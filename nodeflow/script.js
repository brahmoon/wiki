const elements = {
  tree: document.getElementById('tree'),
  addNodeButton: document.getElementById('addNodeButton'),
  workspaceTitle: document.getElementById('workspaceTitle'),
  workspaceDetails: document.getElementById('workspaceDetails'),
  contextMenu: document.getElementById('contextMenu'),
  sidebar: document.getElementById('sidebar'),
  configButton: document.getElementById('sidebarConfigButton'),
  settingsPanel: document.getElementById('sidebarSettings'),
  settingsClose: document.getElementById('sidebarSettingsClose'),
  sidebarStatus: document.getElementById('sidebarStatus'),
  themeToggle: document.getElementById('themeToggle'),
};

let idSequence = 0;
const state = {
  nodes: [],
  selectedNodeId: null,
  contextMenu: {
    visible: false,
    targetId: null,
    type: 'blank',
  },
};

function nextId(prefix = 'node') {
  idSequence += 1;
  return `${prefix}-${idSequence}`;
}

function initializeNodes() {
  const seed = [
    { label: 'Node', type: 'node', children: [] },
    { label: 'Node2', type: 'node', children: [] },
    {
      label: 'Directory',
      type: 'directory',
      children: [
        { label: 'Child', type: 'node', children: [] },
      ],
    },
  ];
  state.nodes = seed.map(item => createNode(item));
}

function createNode({ label, type = 'node', children = [] }) {
  return {
    id: nextId(type === 'directory' ? 'dir' : 'node'),
    label,
    type,
    children: children.map(child => createNode(child)),
  };
}

function cloneNodeWithNewIds(node) {
  return {
    id: nextId(node.type === 'directory' ? 'dir' : 'node'),
    label: node.label,
    type: node.type,
    children: node.children.map(child => cloneNodeWithNewIds(child)),
  };
}

function splitIndexedLabel(label) {
  const trimmed = (label ?? '').trim();
  if (!trimmed) {
    return { base: 'Node', index: null };
  }
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match && match[1]) {
    return {
      base: match[1].trim() || trimmed,
      index: Number.parseInt(match[2], 10),
    };
  }
  return { base: trimmed, index: null };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateIndexedLabel(base, existingLabels) {
  const normalizedBase = base || 'Node';
  const pattern = new RegExp(`^${escapeRegExp(normalizedBase)}(\\d+)?$`, 'i');
  let maxIndex = 0;
  let hasBare = false;
  for (const label of existingLabels) {
    const match = (label ?? '').match(pattern);
    if (match) {
      const index = match[1] ? Number.parseInt(match[1], 10) : 1;
      if (!match[1]) {
        hasBare = true;
      }
      if (index > maxIndex) {
        maxIndex = index;
      }
    }
  }
  if (!hasBare && maxIndex === 0) {
    return normalizedBase;
  }
  const nextIndex = Math.max(maxIndex, hasBare ? 1 : 0) + 1;
  return `${normalizedBase}${nextIndex}`;
}

function findNodeById(id, nodes = state.nodes, parent = null) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === id) {
      return { node, parent, siblings: nodes, index };
    }
    if (node.children.length) {
      const result = findNodeById(id, node.children, node);
      if (result) {
        return result;
      }
    }
  }
  return null;
}

function renderTree() {
  elements.tree.innerHTML = '';
  elements.tree.appendChild(renderNodes(state.nodes, 0));
}

function renderNodes(nodes, depth) {
  const list = document.createElement('ul');
  list.className = depth === 0 ? 'tree' : 'tree__children';
  nodes.forEach(node => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tree__item';
    button.dataset.nodeId = node.id;
    button.dataset.nodeType = node.type;
    if (node.id === state.selectedNodeId) {
      button.classList.add('tree__item--active');
    }
    button.textContent = node.label;
    button.addEventListener('click', () => {
      selectNode(node.id);
      closeContextMenu();
    });
    item.appendChild(button);
    if (node.children.length) {
      item.appendChild(renderNodes(node.children, depth + 1));
    }
    list.appendChild(item);
  });
  return list;
}

function selectNode(id) {
  const found = findNodeById(id);
  state.selectedNodeId = found ? found.node.id : null;
  updateWorkspace(found?.node || null);
  renderTree();
}

function updateWorkspace(node) {
  if (!node) {
    elements.workspaceTitle.textContent = 'ノードを選択してください';
    elements.workspaceDetails.textContent = '';
    return;
  }
  elements.workspaceTitle.textContent = `${node.label} の詳細`;
  const details = [
    `内部 ID: ${node.id}`,
    `タイプ: ${node.type === 'directory' ? 'ディレクトリ' : 'ノード'}`,
    `子要素数: ${node.children.length}`,
  ];
  elements.workspaceDetails.textContent = details.join('\n');
}

function createDirectory(parentId = null) {
  const parent = parentId ? findNodeById(parentId) : null;
  const siblings = parent ? parent.node.children : state.nodes;
  const labels = siblings.map(item => item.label);
  const label = generateIndexedLabel('ディレクトリ', labels);
  const directory = {
    id: nextId('dir'),
    label,
    type: 'directory',
    children: [],
  };
  siblings.push(directory);
  renderTree();
  selectNode(directory.id);
}

function createNodeItem(parentId = null) {
  const parent = parentId ? findNodeById(parentId) : null;
  const siblings = parent ? parent.node.children : state.nodes;
  const labels = siblings.map(item => item.label);
  const label = generateIndexedLabel('Node', labels);
  const newNode = {
    id: nextId('node'),
    label,
    type: 'node',
    children: [],
  };
  siblings.push(newNode);
  renderTree();
  selectNode(newNode.id);
}

function duplicateNode(nodeId) {
  const found = findNodeById(nodeId);
  if (!found) {
    return;
  }
  const { node, siblings, index } = found;
  const clone = cloneNodeWithNewIds(node);
  const { base } = splitIndexedLabel(node.label);
  const labels = siblings.map(item => item.label);
  clone.label = generateIndexedLabel(base, labels);
  siblings.splice(index + 1, 0, clone);
  renderTree();
  selectNode(clone.id);
}

function deleteNode(nodeId) {
  const found = findNodeById(nodeId);
  if (!found) {
    return;
  }
  const { siblings, index } = found;
  siblings.splice(index, 1);
  if (state.selectedNodeId === nodeId) {
    state.selectedNodeId = null;
    updateWorkspace(null);
  }
  renderTree();
  closeContextMenu();
}

function buildContextMenuItems(type, targetId) {
  if (type === 'blank') {
    return [
      {
        key: 'create-root-dir',
        label: 'ディレクトリを作成',
        action: () => {
          createDirectory(null);
        },
      },
    ];
  }
  const found = findNodeById(targetId);
  if (!found) {
    return [];
  }
  const items = [];
  if (found.node.type === 'directory') {
    items.push({
      key: 'add-node',
      label: 'ノードを追加',
      action: () => {
        createNodeItem(found.node.id);
      },
    });
    items.push({
      key: 'add-dir',
      label: 'ディレクトリを作成',
      action: () => {
        createDirectory(found.node.id);
      },
    });
  }
  items.push({
    key: 'duplicate',
    label: 'ノードを複製',
    action: () => {
      duplicateNode(found.node.id);
    },
  });
  items.push({ type: 'divider', key: 'divider' });
  items.push({
    key: 'delete',
    label: '削除',
    danger: true,
    action: () => {
      deleteNode(found.node.id);
    },
  });
  return items;
}

function positionContextMenu(x, y) {
  const menu = elements.contextMenu;
  const { offsetWidth, offsetHeight } = menu;
  const maxX = window.innerWidth - offsetWidth - 8;
  const maxY = window.innerHeight - offsetHeight - 8;
  const left = Math.min(x, Math.max(8, maxX));
  const top = Math.min(y, Math.max(8, maxY));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function openContextMenu(type, targetId, clientX, clientY) {
  state.contextMenu = {
    visible: true,
    type,
    targetId,
  };
  renderContextMenu();
  elements.contextMenu.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    positionContextMenu(clientX, clientY);
  });
}

function closeContextMenu() {
  if (!state.contextMenu.visible) {
    return;
  }
  state.contextMenu.visible = false;
  state.contextMenu.targetId = null;
  elements.contextMenu.setAttribute('aria-hidden', 'true');
  elements.contextMenu.innerHTML = '';
}

function renderContextMenu() {
  const { type, targetId } = state.contextMenu;
  const items = buildContextMenuItems(type, targetId);
  elements.contextMenu.innerHTML = '';
  items.forEach(item => {
    if (item.type === 'divider') {
      const divider = document.createElement('div');
      divider.className = 'context-menu__divider';
      elements.contextMenu.appendChild(divider);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'context-menu__item';
    if (item.danger) {
      button.classList.add('context-menu__item--danger');
    }
    button.textContent = item.label;
    button.dataset.menuItemKey = item.key;
    button.addEventListener('click', () => {
      closeContextMenu();
      item.action();
    });
    elements.contextMenu.appendChild(button);
  });
}

function handleTreeContextMenu(event) {
  const targetButton = event.target.closest('[data-node-id]');
  if (targetButton) {
    event.preventDefault();
    openContextMenu('node', targetButton.dataset.nodeId, event.clientX, event.clientY);
    return;
  }
  if (elements.tree.contains(event.target)) {
    event.preventDefault();
    openContextMenu('blank', null, event.clientX, event.clientY);
  }
}

function handleDocumentClick(event) {
  if (!state.contextMenu.visible) {
    return;
  }
  if (elements.contextMenu.contains(event.target)) {
    return;
  }
  if (event.button === 2) {
    return;
  }
  closeContextMenu();
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeContextMenu();
    closeSettingsPanel();
  }
}

function toggleSettingsPanel(forceOpen) {
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : elements.settingsPanel.getAttribute('aria-hidden') === 'true';
  if (shouldOpen) {
    elements.settingsPanel.setAttribute('aria-hidden', 'false');
    elements.configButton.setAttribute('aria-expanded', 'true');
  } else {
    closeSettingsPanel();
  }
}

function closeSettingsPanel() {
  elements.settingsPanel.setAttribute('aria-hidden', 'true');
  elements.configButton.setAttribute('aria-expanded', 'false');
}

function applyTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', normalized);
  elements.themeToggle.checked = normalized === 'dark';
  try {
    localStorage.setItem('nodeflow-theme', normalized);
  } catch (error) {
    console.warn('Unable to persist theme preference', error);
  }
}

function initializeTheme() {
  let theme = 'light';
  try {
    const stored = localStorage.getItem('nodeflow-theme');
    if (stored === 'dark' || stored === 'light') {
      theme = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  } catch (error) {
    theme = 'light';
  }
  applyTheme(theme);
}

function bindEvents() {
  elements.addNodeButton.addEventListener('click', () => {
    const selected = state.selectedNodeId ? findNodeById(state.selectedNodeId) : null;
    const parentId = selected && selected.node.type === 'directory' ? selected.node.id : null;
    createNodeItem(parentId);
  });

  elements.tree.addEventListener('contextmenu', handleTreeContextMenu);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('contextmenu', event => {
    if (!elements.sidebar.contains(event.target)) {
      closeContextMenu();
    }
  });
  document.addEventListener('keydown', handleKeydown);

  elements.configButton.addEventListener('click', () => {
    const isHidden = elements.settingsPanel.getAttribute('aria-hidden') === 'true';
    toggleSettingsPanel(isHidden);
  });
  elements.settingsClose.addEventListener('click', () => {
    closeSettingsPanel();
  });
  document.addEventListener('click', event => {
    if (elements.settingsPanel.getAttribute('aria-hidden') === 'true') {
      return;
    }
    const isToggle = elements.configButton.contains(event.target);
    const isInsidePanel = elements.settingsPanel.contains(event.target);
    if (!isToggle && !isInsidePanel) {
      closeSettingsPanel();
    }
  });

  elements.themeToggle.addEventListener('change', event => {
    applyTheme(event.target.checked ? 'dark' : 'light');
  });
}

initializeNodes();
initializeTheme();
renderTree();
bindEvents();
closeSettingsPanel();
updateWorkspace(null);
