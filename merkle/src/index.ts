import blessed from 'blessed';
import { EMPTY_LEAF } from './sparse_merkle'
import { TreeDisplay, TreeBox } from './draw_merkle'

const PRETTY = true;
const SORT_HASH = true;
const VIEW_WIDTH = 100;
const INIT_LEVEL = 5;

let horiz_offset = 0;
let tree = new TreeDisplay(BigInt(INIT_LEVEL), SORT_HASH, PRETTY);
let tree_data: TreeBox = tree.drawTree()
let view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);

// Create a screen object
const screen = blessed.screen({
    smartCSR: true,
    title: 'Sparse Merkle Tree'
});

// ===============================================
// Input form elements
const formInputs = blessed.form({
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
    parent: formInputs,
    top: 1,
    left: 1,
    height: 3,
    width: 20,
    mouse: true,
    name: 'Levels',
    value: INIT_LEVEL.toString(),
    inputOnFocus: true,
    border: { type: 'line' },
    label: 'Levels'
});

const levelButton = blessed.button({
    parent: formInputs,
    top: 4,
    left: 1,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
    name: 'reset',
    content: 'Reset',
    style: {
        bg: 'blue',
        focus: {
            bg: 'cyan'
        }
    }
});

// Mekle Leaf
const leafInput = blessed.textbox({
    parent: formInputs,
    top: 6,
    left: 1,
    height: 3,
    width: 20,
    mouse: true,
    name: 'Leaf',
    inputOnFocus: true,
    border: { type: 'line' },
    label: 'Leaf'
});

const addButton = blessed.button({
    parent: formInputs,
    top: 9,
    left: 1,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
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
    parent: formInputs,
    top: 11,
    left: 1,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
    name: 'del_leaf',
    content: 'Delete Leaf',
    style: {
        bg: 'blue',
        focus: {
            bg: 'cyan'
        }
    }
});

const proveButton = blessed.button({
    parent: formInputs,
    top: 13,
    left: 1,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
    name: 'prove_leaf',
    content: 'P-o-M',
    style: {
        bg: 'blue',
        focus: {
            bg: 'cyan'
        }
    }
});

const closeButton = blessed.button({
    parent: formInputs,
    left: 1,
    bottom: 1,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 2,
        right: 2
    },
    name: 'close',
    content: 'Close',
    style: {
        bg: 'blue',
        focus: {
            bg: 'cyan'
        }
    }
});
// ===============================================

// ===============================================
// Tree display box elements
const treeBoxParent = blessed.box({
    parent: screen,
    right: 1,
    height: '100%',
    width: VIEW_WIDTH + 4,
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
    keys: true,             // Enable keyboard scrolling
    vi: true
});

const treeBox = blessed.box({
    parent: treeBoxParent,
    top: 0,
    left: 0,
    right: 1,
    height: "80%",
    mouse: true,
    tags: true,
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

const treeInfo = blessed.box({
    parent: treeBoxParent,
    bottom: 0,
    left: 0,
    right: 1,
    height: "20%",
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
// ===============================================

function showError(error: string) {
    treeInfo.setContent("ERROR: " + error);
    screen.render();
}

function validatedLevel(): number {
    let levelStr = levelInput.getValue()
    let level = Number(levelStr)

    if ((levelStr === "") || isNaN(level)) {
        showError("Invalid level!");
        return -1;
    }

    if ((level < 2) || (level > 10)) {
        showError("Level out of range! Valid range [2,10]");
        return -1;
    }

    return level;
}

function validatedLeaf(): number {
    let leafStr = leafInput.getValue();
    let leaf = Number(leafStr)

    if ((leafStr === "") || isNaN(leaf)) {
        showError("Invalid leaf index!");
        return -1;
    }

    if ((leaf < tree.lowerIndex()) || (leaf > tree.upperIndex())) {
        showError(`Leaf out of range! Valid range [${tree.lowerIndex()},${tree.upperIndex()}]`);
        return -1;
    }

    return leaf;
}

// ===============================================
// Event Handlers
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

// Change tree size
levelButton.on('press', () => {
    let level = validatedLevel();
    if (level < 0) return;

    if (tree.LEVELS_TOTAL() === BigInt(level))
        return;

    horiz_offset = 0;
    tree = new TreeDisplay(BigInt(level), SORT_HASH, PRETTY);
    tree_data = tree.drawTree()
    view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);
    treeBox.setContent(view_data);
    treeInfo.setContent("");
    screen.render();
});

// Add leaf
addButton.on('press', () => {
    let leaf = validatedLeaf();
    if (leaf < 0) return;

    horiz_offset = 0;
    let leafHash = tree.addLeaf(BigInt(leaf), leaf.toString(16))
    tree_data = tree.drawTree()
    view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);
    treeBox.setContent(view_data);
    treeInfo.setContent(`Added leaf ${leaf}. ${leafHash}`);
    screen.render();
});

// Reset leaf to empty
delButton.on('press', () => {
    let leaf = validatedLeaf();
    if (leaf < 0) return;

    horiz_offset = 0;
    let leafHash = tree.addLeaf(BigInt(leaf), EMPTY_LEAF)
    tree_data = tree.drawTree()
    view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);
    treeBox.setContent(view_data);
    treeInfo.setContent(`Removed leaf ${leaf}. ${leafHash}`);
    screen.render();
});

// Compute proof-of-membership parameters
proveButton.on('press', () => {
    let leaf = validatedLeaf();
    if (leaf < 0) return;

    let proof = tree.getProof(BigInt(leaf));

    treeInfo.setContent(
        `Root: ${proof.root}\n` +
        `Leaf: ${proof.leaf}\n` +
        `Address: ${leaf} (${leaf.toString(2).padStart(Number(tree.LEVELS_TOTAL()), '0')})\n` +
        'Siblings: \n   ' +
        proof.siblings.toString().replace(/,/g, '\n   '));
    screen.render();
});
// ===============================================

// Add content to the box that exceeds its size
treeBox.setContent(view_data);

// Render the screen
screen.render();
