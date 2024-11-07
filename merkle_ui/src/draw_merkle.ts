import { IMerkle, MerkleWrapper } from "zkyes-smt"

const NODE_WIDTH = 10;
const NODE_HEIGHT = 3;
const NODE_HSPACING = 6;
const NODE_VSPACING = 2;
const NEWLINE = "\n";
const NEWLINE_LEN = NEWLINE.length;

const BOX_TOP = "+--------+";
const BOX_BOTTOM = "+--------+";
const BOX_TOP_PRETTY = "<-------->";
const BOX_BOTTOM_PRETTY = "{--------}";

const CORNER = "+";
const CORNER_LEFT_PRETTY = "<";
const CORNER_RIGHT_PRETTY = ">";

const TEE = "+";
const TEE_PRETTY = "+";

export type TreeBox = {
    text: string,
    width: number,
    height: number
}

// A "display ready" Sparse Merkle tree.
// The class adds the ability to display
// the tree at the console. It is aware of 
// scrolling and supports having a small 
// view window over a large tree.
export class TreeDisplay extends MerkleWrapper {

    private _pretty: boolean;

    // Initialize a TreeDisplay instance
    //
    // Inputs
    //      tree - Tree instance to be displayed
    //
    //      pretty - if true, instance will use unicode characters
    //      to smothen the edges of the tree drawing. Otherwise
    //      the output will be limited to ansi characters.
    constructor(tree: IMerkle, pretty: boolean = false) {
        super(tree);
        this._pretty = pretty;
    }

    private _BOX_TOP(): string {
        return this._pretty ? BOX_TOP_PRETTY : BOX_TOP;
    }

    private _BOX_BOTTOM(): string {
        return this._pretty ? BOX_BOTTOM_PRETTY : BOX_BOTTOM;
    }

    private _CORNER_LEFT(): string {
        return this._pretty ? CORNER_LEFT_PRETTY : CORNER;
    }

    private _CORNER_RIGHT(): string {
        return this._pretty ? CORNER_RIGHT_PRETTY : CORNER;
    }

    private _TEE(): string {
        return this._pretty ? TEE_PRETTY : TEE;
    }

    // Replace all "special" characters with the 
    // unicode substitue for the "pretty" mode.
    // Note that the ansi characters are just 
    // place-holders not ment for display.
    //
    // Inputs
    //      raw - string to convert
    //
    // Returns
    //      Converted string 
    private _prettify(raw: string): string {
        return raw
            .split('')
            .map(char => {
                if (char === '-') return '─';
                else if (char === '|') return '│';
                else if (char === '<') return '┌';
                else if (char === '>') return '┐';
                else if (char === '{') return '└';
                else if (char === '}') return '┘';
                else if (char === '+') return '┴';
                return char;
            })
            .join('');
    }

    // Get the number of nodes for a given tree level
    // where 0 is the root, 1 the root siblings and so forth.
    private _getNodesByLevel(level: number): number {
        return 2 ** level; //level 0 => root
    }

    // If the tree is using inverted indexes,
    // invert the index bits to get the correct index
    private _adjustIndex(index: number): number {
        if (!this.INVERTED_INDEX())
            return index;

        const BIT_CNT = Number(this.LEVELS_TOTAL());
        let indexBits = index.toString(2)

        // Ensure correct width
        if (indexBits.length > BIT_CNT)
            throw "Index out of range";

        else if (indexBits.length < BIT_CNT)
            indexBits = indexBits.padStart(BIT_CNT, '0')

        // Invert bits
        indexBits = indexBits.split('').reverse().join('')

        return parseInt(indexBits, 2)
    }

    // Draw a boxed node
    //
    // Inputs
    //      node - hash of the node
    //
    //      level - node level where zero is the root
    //
    //      horizIdx - node index (address) for the given level
    //
    //      totalwidth - total width in characters taken by the tree.
    //      This is the width taken to fit all the leaf nodes of a tree.
    //
    //      buffer - buffer to which the node is to be written.
    private _drawNode(node: string, level: number, horizIdx: number, totalwidth: number, buffer: Buffer) {
        let vertPos = level * (NODE_HEIGHT + NODE_VSPACING);
        let nodeSpace = totalwidth / this._getNodesByLevel(level);
        let horizPos = Math.round((nodeSpace * horizIdx) + (nodeSpace - NODE_WIDTH) / 2);

        buffer.write(this._BOX_TOP(), vertPos * totalwidth + horizPos, 'utf8');
        buffer.write(`| ${node.substring(0, 6)} |`, (vertPos + 1) * totalwidth + horizPos, 'utf8');
        buffer.write(this._BOX_BOTTOM(), (vertPos + 2) * totalwidth + horizPos, 'utf8');

        if (BigInt(level) < this.LEVELS_TOTAL()) {
            let childSpace = totalwidth / this._getNodesByLevel(level + 1);
            let start1 = Math.round((childSpace * horizIdx * 2) + childSpace);
            let start2 = Math.round((childSpace * horizIdx * 2) + childSpace / 2);
            let line = this._CORNER_LEFT() + '-'.repeat(Math.round(childSpace - 2)) + this._CORNER_RIGHT();

            buffer.write("|", (vertPos + 3) * totalwidth + start1, 'utf8');
            buffer.write(line, (vertPos + 4) * totalwidth + start2, 'utf8');
            buffer.write(this._TEE(), (vertPos + 4) * totalwidth + start1, 'utf8');
        }
        else if (BigInt(level) == this.LEVELS_TOTAL()) {
            let childSpace = totalwidth / this._getNodesByLevel(level + 1);
            let start1 = Math.round((childSpace * horizIdx * 2) + childSpace);
            buffer.write(this._adjustIndex(horizIdx).toString(), (vertPos + 3) * totalwidth + start1, 'utf8');
        }
    }

    // A recursive function that draws the tree from the given parent node.
    //
    // Inputs
    //      nodeHash - Depending on traversal type, one of the following:
    //            1. Parent node hash for which the subtree is to be drawn.
    //            2. Leaf hash of a short-circuited single non-zero leaf
    //               subtree.
    //
    //      shortAddr - Depending on traversal type, one of the following:
    //              1. Leaf address of a short-circuited single non-zero leaf 
    //                 subtree. 
    //              2. Otherwise set this to -1
    //
    //      level - parent node level, where zero is the root.
    //
    //      horizIdx - node index (address) for the given level
    //
    //      totalwidth - total width in characters taken by the tree.
    //      This is the width taken to fit all the leaf nodes of a tree.
    //
    //      buffer - buffer to which the subtree is to be written.
    private async _drawTreeLevel(
        nodeHash: string,
        shortAddr: bigint,
        level: number,
        horizIdx: number,
        totalwidth: number,
        buffer: Buffer) {

        // SMTSingleLeafEx has an extra level which we won't display
        if (BigInt(level) > this.LEVELS_TOTAL())
            return;

        if (shortAddr >= 0n) {
            if (BigInt(level) < this.LEVELS_TOTAL()) {
                this._drawNode("   x  ", level, horizIdx, totalwidth, buffer);

                await this._drawTreeLevel(nodeHash, shortAddr, level + 1, horizIdx * 2, totalwidth, buffer)
                await this._drawTreeLevel(nodeHash, shortAddr, level + 1, horizIdx * 2 + 1, totalwidth, buffer)
            }
            else if (shortAddr != BigInt(this._adjustIndex(horizIdx)))
                this._drawNode("   x  ", level, horizIdx, totalwidth, buffer);
            else
                this._drawNode(nodeHash, level, horizIdx, totalwidth, buffer);
        }
        else if (this.isZeroTree(nodeHash, level)) {
            this._drawNode("   0  ", level, horizIdx, totalwidth, buffer);

            if (level < this.LEVELS_TOTAL()) {
                await this._drawTreeLevel(this.HASH_ZERO_TREE(level + 1), -1n, level + 1, horizIdx * 2, totalwidth, buffer)
                await this._drawTreeLevel(this.HASH_ZERO_TREE(level + 1), -1n, level + 1, horizIdx * 2 + 1, totalwidth, buffer)
            }
        }
        else {
            this._drawNode(nodeHash, level, horizIdx, totalwidth, buffer);

            let subtree = this.TREE(nodeHash)
            if (subtree?.length === 2) {
                await this._drawTreeLevel(subtree[0], -1n, level + 1, horizIdx * 2, totalwidth, buffer)
                await this._drawTreeLevel(subtree[1], -1n, level + 1, horizIdx * 2 + 1, totalwidth, buffer)
            }
            if (subtree?.length === 3) {
                let addr = BigInt("0x" + subtree[0])
                await this._drawTreeLevel(await this.hashLeaf(subtree), addr, level + 1, horizIdx * 2, totalwidth, buffer)
                await this._drawTreeLevel(await this.hashLeaf(subtree), addr, level + 1, horizIdx * 2 + 1, totalwidth, buffer)
            }
        }
    }

    // Draws the Merkle Sparse tree
    //
    // Returns
    //      A TreeBox structure containing the tree text representation
    //      and the width and hight (in characters) of the box containing
    //      the tree.
    //
    //      The tree text is not intended for direct display. The tree 
    //      may be much bigger than the display. Furthermore if "prettify" 
    //      mode is enabled the text will contain characters to be replaced
    //      for correct display.
    async drawTree(): Promise<TreeBox> {

        const WIDTH = Number((this.upperIndex() + 1n)) * NODE_WIDTH +
            Number(this.upperIndex()) * NODE_HSPACING + NEWLINE_LEN;

        // Tree height + 1 line for the leaf index
        const HEIGHT = NODE_HEIGHT * Number(this.LEVELS_TOTAL() + 1n) +
            NODE_VSPACING * Number(this.LEVELS_TOTAL()) + 1;

        let line = ' '.repeat(WIDTH - NEWLINE_LEN) + NEWLINE;

        const bufferSize = Buffer.byteLength(line) * HEIGHT;
        const buffer = Buffer.alloc(bufferSize);

        for (let lineCnt = 0; lineCnt < HEIGHT; lineCnt++) {
            buffer.write(line, lineCnt * Buffer.byteLength(line), 'utf8');
        }

        await this._drawTreeLevel(this.ROOT(), -1n, 0, 0, WIDTH, buffer);

        return {
            text: buffer.toString('utf8'),
            width: WIDTH,
            height: HEIGHT
        };
    }

    // Produces the tree text content ready for display.
    //
    // Inputs
    //      horizOffset - Horizontal view offset in characters. This allows 
    //      implementing horizontal scrolling where the initial characters
    //      have been scrolled out of display.
    //
    //      viewWidth - Max number of characters that may be displayed in one line
    //      without the display wrapping over.
    //
    //      tree_data - Raw tree data from which the view is to be extracted.
    //
    // Returns
    //      A string containing the tree slice to be displayed.
    viewTree(horizOffset: number, viewWidth: number, tree_data: TreeBox): string {

        if ((horizOffset < 0) ||
            (viewWidth <= 1) ||  // View will always contain line termination LF
            (tree_data.width <= 0) ||
            (tree_data.height <= 0))
            throw "Invalid dimensions";

        if (viewWidth >= tree_data.width)
            return this._pretty ? this._prettify(tree_data.text) : tree_data.text;

        if (horizOffset + viewWidth > tree_data.width)
            throw "Invalid dimensions";

        const buffer = Buffer.alloc(viewWidth * tree_data.height);

        for (let cnt = 0; cnt < tree_data.height; ++cnt) {
            let start = cnt * tree_data.width + horizOffset;
            let end = start + viewWidth - 1;
            buffer.write(tree_data.text.substring(start, end) + NEWLINE, cnt * viewWidth, "utf8");
        }

        let viewText = buffer.toString('utf8');
        if (this._pretty) {
            return this._prettify(viewText);
        }

        return viewText;
    }
}
