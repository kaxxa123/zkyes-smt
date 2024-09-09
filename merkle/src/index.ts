import blessed from 'blessed';
import { EMPTY_LEAF } from './sparse_merkle'
import { TreeDisplay, TreeBox } from './draw_merkle'
import { CONFIG_JSON, TreeConfig, loadConfigOR } from './config'

const PRETTY = true;
const VIEW_WIDTH = 100;
const TEXTBOX_HEIGHT = 3;
const BUTTON_HEIGHT = 2;
const DEFAULT_CONFIG: TreeConfig = {
    level: 5,
    sort_hash: true,
    leafs: []
};

let g_horiz_offset: number;
let g_control_top: number;
let g_sortHashes: boolean;
let g_tree: TreeDisplay;
let g_tree_data: TreeBox;
let g_view_data: string;

async function main() {
    let json_config = await loadConfigOR(CONFIG_JSON, DEFAULT_CONFIG);
    if ((json_config.level < 2) || (json_config.level > 10))
        json_config = DEFAULT_CONFIG;

    g_control_top = 1;
    g_horiz_offset = 0;
    g_sortHashes = json_config.sort_hash;
    g_tree = new TreeDisplay(BigInt(json_config.level), json_config.sort_hash, PRETTY);
    json_config.leafs.forEach(leaf => {
        g_tree.addLeaf(BigInt(leaf.index), leaf.value);
    })

    g_tree_data = g_tree.drawTree()
    g_view_data = g_tree.viewTree(g_horiz_offset, VIEW_WIDTH, g_tree_data);

    // ===============================================
    // =========== Visual Screen Elements ============
    const screen = blessed.screen({
        smartCSR: true,
        title: 'Sparse Merkle Tree'
    });

    // * * * * Input form elements * * * *
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

    const levelInput = blessed.textbox({
        parent: formInputs,
        top: g_control_top,
        left: 1,
        height: TEXTBOX_HEIGHT,
        width: 20,
        mouse: true,
        name: 'Levels',
        value: g_tree.LEVELS_TOTAL().toString(),
        inputOnFocus: true,
        border: { type: 'line' },
        label: 'Levels'
    });
    g_control_top += TEXTBOX_HEIGHT;

    const levelButton = blessed.button({
        parent: formInputs,
        top: g_control_top,
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
    g_control_top += BUTTON_HEIGHT;

    const sortHashCheckbox = blessed.checkbox({
        parent: formInputs,
        top: g_control_top,
        left: 1,
        mouse: true,
        content: 'Sorted hashes',
        checked: g_tree.SORT_HASH()
    });
    g_control_top += BUTTON_HEIGHT;

    const leafInput = blessed.textbox({
        parent: formInputs,
        top: g_control_top,
        left: 1,
        height: TEXTBOX_HEIGHT,
        width: 20,
        mouse: true,
        name: 'leafIdx',
        inputOnFocus: true,
        border: { type: 'line' },
        label: 'Leaf Idx'
    });
    g_control_top += TEXTBOX_HEIGHT;

    const valueInput = blessed.textbox({
        parent: formInputs,
        top: g_control_top,
        left: 1,
        height: TEXTBOX_HEIGHT,
        width: 20,
        mouse: true,
        name: 'leafValue',
        inputOnFocus: true,
        border: { type: 'line' },
        label: 'Leaf Value'
    });
    g_control_top += TEXTBOX_HEIGHT;

    const addButton = blessed.button({
        parent: formInputs,
        top: g_control_top,
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
    g_control_top += BUTTON_HEIGHT;

    const delButton = blessed.button({
        parent: formInputs,
        top: g_control_top,
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
    g_control_top += BUTTON_HEIGHT;

    const proveButton = blessed.button({
        parent: formInputs,
        top: g_control_top,
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
    g_control_top += BUTTON_HEIGHT;

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

    // * * * * Tree Display elements * * * *
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

    // * * * * Helper Functions * * * *
    const showError = (error: string) => {
        treeInfo.setContent("ERROR: " + error);
        screen.render();
    }

    const reinitTree = (levels: bigint, sort: boolean) => {
        g_horiz_offset = 0;
        g_sortHashes = sort;
        g_tree = new TreeDisplay(levels, g_sortHashes, PRETTY);
        g_tree_data = g_tree.drawTree()
        g_view_data = g_tree.viewTree(g_horiz_offset, VIEW_WIDTH, g_tree_data);
        treeBox.setContent(g_view_data);
        treeInfo.setContent(`Tree reinit! Levels: ${levels}, Sorted Hashes: ` + (sort ? "Yes" : "No"));
        screen.render();
    }

    const validatedLevel = (): number => {
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

    const validatedLeaf = (): number => {
        let leafStr = leafInput.getValue();
        let leaf = Number(leafStr)

        if ((leafStr === "") || isNaN(leaf)) {
            showError("Invalid leaf index!");
            return -1;
        }

        if ((leaf < g_tree.lowerIndex()) || (leaf > g_tree.upperIndex())) {
            showError(`Leaf out of range! Valid range [${g_tree.lowerIndex()},${g_tree.upperIndex()}]`);
            return -1;
        }

        return leaf;
    }

    const validatedValue = (): string => {
        let valueStr = valueInput.getValue().trim();

        if (valueStr.length === 0)
            return valueStr;

        if (valueStr.startsWith("0x")) {
            valueStr = valueStr.slice(2);

            if (valueStr.length === 0) {
                showError("Invalid value! Specify hex value or leave empty to use leaf index");
                return "z";
            }
        }

        let regex = /^[0-9a-fA-F]+$/;
        if (!regex.test(valueStr)) {
            showError("Invalid value! Specify hex value or leave empty to use leaf index");
            return "z";
        }

        return valueStr;
    }

    // * * * * Event Handlers * * * *
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
            if (g_horiz_offset < g_tree_data.width - VIEW_WIDTH)
                g_horiz_offset += 1;

        } else if (key.name === 'left') {
            if (g_horiz_offset > 0)
                g_horiz_offset -= 1;
        }

        g_view_data = g_tree.viewTree(g_horiz_offset, VIEW_WIDTH, g_tree_data);
        treeBox.setContent(g_view_data);
        screen.render();
    });

    // Enable hash sorting mode
    sortHashCheckbox.on('check', () => {
        if (g_sortHashes) return;
        reinitTree(g_tree.LEVELS_TOTAL(), true);
    });

    // Disable hash sorting mode
    sortHashCheckbox.on('uncheck', () => {
        if (!g_sortHashes) return;
        reinitTree(g_tree.LEVELS_TOTAL(), false);
    });

    // Change tree size
    levelButton.on('press', () => {
        let level = validatedLevel();
        if (level < 0) return;

        if (g_tree.LEVELS_TOTAL() === BigInt(level))
            return;

        reinitTree(BigInt(level), g_sortHashes);
    });

    // Add leaf
    addButton.on('press', () => {
        let leaf = validatedLeaf();
        if (leaf < 0) return;

        let value = validatedValue();
        if (value == "z") return;

        if (value.length == 0)
            value = leaf.toString(16);

        value = g_tree.normalizePreimage(value);

        g_horiz_offset = 0;
        let leafHash = g_tree.addLeaf(BigInt(leaf), value);

        g_tree_data = g_tree.drawTree()
        g_view_data = g_tree.viewTree(g_horiz_offset, VIEW_WIDTH, g_tree_data);
        treeBox.setContent(g_view_data);
        treeInfo.setContent(`Added leaf Index: ${leaf}\n` +
            `Value: ${value}\n` +
            `Hash:  ${leafHash}`);
        screen.render();
    });

    // Reset leaf to empty
    delButton.on('press', () => {
        let leaf = validatedLeaf();
        if (leaf < 0) return;

        g_horiz_offset = 0;
        let leafHash = g_tree.addLeaf(BigInt(leaf), EMPTY_LEAF)
        g_tree_data = g_tree.drawTree()
        g_view_data = g_tree.viewTree(g_horiz_offset, VIEW_WIDTH, g_tree_data);
        treeBox.setContent(g_view_data);
        treeInfo.setContent(`Removed leaf ${leaf}. ${leafHash}`);
        screen.render();
    });

    // Compute proof-of-membership parameters
    proveButton.on('press', () => {
        let leaf = validatedLeaf();
        if (leaf < 0) return;

        let proof = g_tree.getProof(BigInt(leaf));

        treeInfo.setContent(
            `Root: ${proof.root}\n` +
            `Leaf: ${proof.leaf}\n` +
            `Address: ${leaf} (${leaf.toString(2).padStart(Number(g_tree.LEVELS_TOTAL()), '0')})\n` +
            'Siblings: \n   ' +
            proof.siblings.toString().replace(/,/g, '\n   '));
        screen.render();
    });

    // Add content to the box that exceeds its size
    treeBox.setContent(g_view_data);

    // Render the screen
    screen.render();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
