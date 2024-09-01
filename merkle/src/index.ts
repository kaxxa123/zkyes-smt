import blessed from 'blessed';
import { TreeDisplay, TreeBox } from './draw_merkle'

const PRETTY = true;
const VIEW_WIDTH = 100;

let tree = new TreeDisplay(5n, PRETTY);
tree.addLeaf(3n, "3")
tree.addLeaf(5n, "5")
tree.addLeaf(10n, "10")

let horiz_offset = 0;
let vert_offset = 0;
let tree_data: TreeBox = tree.drawTree()
let view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);

// Create a screen object
const screen = blessed.screen({
    smartCSR: true,
    title: 'Sparse Merkle Tree'
});

// Create a scrollable box
const treeBox = blessed.box({
    top: 'center',
    left: 'center',
    width: VIEW_WIDTH + 3,
    height: '80%',          // Box height is 70% of the screen height
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

// Function to update visible data
function updateScrollbar(horiz: boolean) {

    const scrollPercentage = Math.min(horiz_offset / (tree_data.width - VIEW_WIDTH), 1);
    const scrollbarWidth = Math.max(Math.round(VIEW_WIDTH * (VIEW_WIDTH / tree_data.width)), 1);
    const scrollbarPosition = Math.round(scrollPercentage * (VIEW_WIDTH - scrollbarWidth));

    let scrollbar = '';
    for (let pos = 0; pos < VIEW_WIDTH; pos++) {
        if (pos >= scrollbarPosition && pos < scrollbarPosition + scrollbarWidth) {
            scrollbar += PRETTY ? '▄' : '=';
        } else {
            scrollbar += PRETTY ? ' ' : '-';
        }
    }

    if (horiz) {
        view_data = tree.viewTree(horiz_offset, VIEW_WIDTH, tree_data);
    }

    treeBox.setContent(view_data);
    treeBox.setLine(Number(treeBox.height) + vert_offset - 3, scrollbar);
}

// Quit on Escape, q, or Control-C
screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    return process.exit(0);
});

// Handle horizontal scrolling.
screen.key(['left', 'right'], function (ch, key) {

    if (key.name === 'right') {
        if (horiz_offset < tree_data.width - VIEW_WIDTH)
            horiz_offset += 1;

    } else if (key.name === 'left') {
        if (horiz_offset > 0)
            horiz_offset -= 1;
    }

    updateScrollbar(true);
    screen.render();
});

screen.key(['up', 'down'], function (ch, key) {

    if (key.name === 'down') {
        if (vert_offset < tree_data.height - Number(treeBox.height) + 3)
            vert_offset += 1;

    } else if (key.name === 'up') {
        if (vert_offset > 0)
            vert_offset -= 1;
    }

    updateScrollbar(false);
    screen.render();
});

// Listen for screen resize events
screen.on('resize', () => {
    updateScrollbar(false);
    screen.render();
});

// Add content to the box that exceeds its size
treeBox.setContent(view_data);

// Append the scrollable box to the screen
screen.append(treeBox);

// Render the screen
screen.render();

// Draw bottom scrollbar do this after the first
// rendering as updateScrollbar requires the box
// dimensions.
updateScrollbar(false);
screen.render();
