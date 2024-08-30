import blessed from 'blessed';
import { TreeDisplay } from './draw_merkle'

const VIEW_WIDTH = 100;

let tree = new TreeDisplay(5n);
tree.addLeaf(3n, "3")
tree.addLeaf(5n, "5")
tree.addLeaf(10n, "10")

let view_offset = 0;
let tree_data = tree.drawTree()
let view_data = tree.viewTree(view_offset, VIEW_WIDTH, tree_data);

// Create a screen object
const screen = blessed.screen({
    smartCSR: true,
    title: 'Sparse Merkle Tree'
});

// Create a scrollable box
const scrollableBox = blessed.box({
    top: 'center',
    left: 'center',
    width: VIEW_WIDTH + 5,
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
function updateScrollbar() {
    scrollableBox.setContent(tree.viewTree(view_offset, VIEW_WIDTH, tree_data));
}

// Quit on Escape, q, or Control-C
screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    return process.exit(0);
});

// Handle horizontal scrolling.
screen.key(['left', 'right'], function (ch, key) {

    if (key.name === 'right') {
        if (view_offset < tree_data.width - VIEW_WIDTH)
            view_offset += 1;

    } else if (key.name === 'left') {
        if (view_offset > 0)
            view_offset -= 1;
    }

    updateScrollbar();
    screen.render();
});

// Add content to the box that exceeds its size
scrollableBox.setContent(view_data);

// Append the scrollable box to the screen
screen.append(scrollableBox);

// Render the screen
screen.render();
