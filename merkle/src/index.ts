import blessed from 'blessed';
import { EMPTY_NODE } from './sparse_merkle'
import { TreeDisplay, TreeBox } from './draw_merkle'

const PRETTY = true;
const VIEW_WIDTH = 100;
const INIT_LEVEL = 5;

let horiz_offset = 0;
let tree = new TreeDisplay(BigInt(INIT_LEVEL), PRETTY);
let tree_data: TreeBox = tree.drawTree()
let view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);

// Create a screen object
const screen = blessed.screen({
    smartCSR: true,
    title: 'Sparse Merkle Tree'
});

// Main form
const form = blessed.form({
    parent: screen,
    width: '20%',
    height: '100%',
    keys: true,
    vi: true,
    border: 'line',
    label: 'Sparse Merkle Tree',
    tags: true
});

// Mekle Depth
const levelInput = blessed.textbox({
    parent: form,
    mouse: true,
    name: 'Levels',
    value: INIT_LEVEL.toString(),
    top: 1,
    left: 1,
    height: 3,
    width: 20,
    inputOnFocus: true,
    border: { type: 'line' },
    label: 'Levels'
});

// Mekle Leaf
const leafInput = blessed.textbox({
    parent: form,
    mouse: true,
    name: 'Leaf',
    top: 6,
    left: 1,
    height: 3,
    width: 20,
    inputOnFocus: true,
    border: { type: 'line' },
    label: 'Leaf'
});

const resetButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
    left: 1,
    top: 4,
    name: 'reset',
    content: 'Reset',
    style: {
        bg: 'blue',
        focus: {
            bg: 'cyan'
        }
    }
});

const addButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
    left: 1,
    top: 9,
    name: 'add_leaf',
    content: 'Add Leaf',
    style: {
        bg: 'blue',
        focus: {
            bg: 'cyan'
        }
    }
});

const delButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
    left: 1,
    top: 11,
    name: 'del_leaf',
    content: 'Delete Leaf',
    style: {
        bg: 'blue',
        focus: {
            bg: 'cyan'
        }
    }
});

const closeButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
    left: 1,
    bottom: 1,
    name: 'close',
    content: 'Close',
    style: {
        bg: 'blue',
        focus: {
            bg: 'cyan'
        }
    }
});

// Create a scrollable box
const treeBox = blessed.box({
    parent: screen,
    top: 1,
    right: 1,
    bottom: 1,
    width: VIEW_WIDTH + 3,
    mouse: true,
    tags: true,
    border: {
        type: 'line'
    },
    style: {
        border: {
            fg: '#f0f0f0'
        },
        scrollbar: {
            bg: 'blue'
        }
    },
    scrollable: true,       // Enable scrolling
    alwaysScroll: true,     // Ensure the scroll bar is always visible
    scrollbar: {
        ch: ' ',            // Character to use for the scrollbar
        track: {
            bg: 'grey'      // Background color of the scrollbar track
        },
        style: {
            inverse: true   // Inverse color style for scrollbar thumb
        }
    },
    keys: true,             // Enable keyboard scrolling
    vi: true
});

// Quit on Escape, q, or Control-C
screen.key(['escape', 'C-c'], (ch, key) => {
    return process.exit(0);
});

// Quit on Close
closeButton.on('press', () => {
    return process.exit(0);
});

// Handle horizontal scrolling.
treeBox.key(['left', 'right'], function (ch, key) {

    if (key.name === 'right') {
        if (horiz_offset < tree_data.width - VIEW_WIDTH)
            horiz_offset += 1;

    } else if (key.name === 'left') {
        if (horiz_offset > 0)
            horiz_offset -= 1;
    }

    view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);
    treeBox.setContent(view_data);
    screen.render();
});

resetButton.on('press', () => {
    let levelStr = levelInput.getValue()
    let level = Number(levelStr)

    if (isNaN(level))
        return;

    if ((level < 2) || (level > 10))
        return;

    horiz_offset = 0;
    tree = new TreeDisplay(BigInt(level), PRETTY);
    tree_data = tree.drawTree()
    view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);
    treeBox.setContent(view_data);
    screen.render();
});

addButton.on('press', () => {
    let leafStr = leafInput.getValue();
    let leaf = Number(leafStr)

    if ((leafStr == "") || isNaN(leaf))
        return;

    if ((leaf < tree.lowerIndex()) || (leaf > tree.upperIndex()))
        return;

    horiz_offset = 0;
    tree.addLeaf(BigInt(leaf), leaf.toString())
    tree_data = tree.drawTree()
    view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);
    treeBox.setContent(view_data);
    screen.render();
});

delButton.on('press', () => {
    let leafStr = leafInput.getValue();
    let leaf = Number(leafStr)

    if ((leafStr == "") || isNaN(leaf))
        return;

    if ((leaf < tree.lowerIndex()) || (leaf > tree.upperIndex()))
        return;

    horiz_offset = 0;
    tree.addLeaf(BigInt(leaf), EMPTY_NODE)
    tree_data = tree.drawTree()
    view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);
    treeBox.setContent(view_data);
    screen.render();
});

// Add content to the box that exceeds its size
treeBox.setContent(view_data);

// Render the screen
screen.render();
