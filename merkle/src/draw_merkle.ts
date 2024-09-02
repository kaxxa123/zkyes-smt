import { SMT } from './sparse_merkle'

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

export class TreeDisplay extends SMT {

    private _pretty: boolean;

    constructor(lvl: bigint, pretty: boolean = false) {
        super(lvl);
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

    private _getNodesByLevel(level: number) {
        return 2 ** level; //level 0 => root
    }

    private _drawNode(node: string, level: number, horiz: number, totalwidth: number, buffer: Buffer) {
        let vertPos = level * (NODE_HEIGHT + NODE_VSPACING);
        let nodeSpace = totalwidth / this._getNodesByLevel(level);
        let horizPos = Math.round((nodeSpace * horiz) + (nodeSpace - NODE_WIDTH) / 2);

        buffer.write(this._BOX_TOP(), vertPos * totalwidth + horizPos, 'utf8');
        buffer.write(`| ${node.substring(0, 6)} |`, (vertPos + 1) * totalwidth + horizPos, 'utf8');
        buffer.write(this._BOX_BOTTOM(), (vertPos + 2) * totalwidth + horizPos, 'utf8');

        if (level < this.LEVELS_TOTAL()) {
            let childSpace = totalwidth / this._getNodesByLevel(level + 1);
            let start1 = Math.round((childSpace * horiz * 2) + childSpace);
            let start2 = Math.round((childSpace * horiz * 2) + childSpace / 2);
            let line = this._CORNER_LEFT() + ''.padEnd(Math.round(childSpace - 2), '-') + this._CORNER_RIGHT();

            buffer.write("|", (vertPos + 3) * totalwidth + start1, 'utf8');
            buffer.write(line, (vertPos + 4) * totalwidth + start2, 'utf8');
            buffer.write(this._TEE(), (vertPos + 4) * totalwidth + start1, 'utf8');
        }
    }

    _drawTreeLevel(node: string, level: number, horiz: number, totalwidth: number, buffer: Buffer) {
        if (this.isZeroTree(node)) {
            this._drawNode("   0  ", level, horiz, totalwidth, buffer);

            if (level < this.LEVELS_TOTAL()) {
                this._drawTreeLevel(this.HASH_ZERO_TREE(level + 1), level + 1, horiz * 2, totalwidth, buffer)
                this._drawTreeLevel(this.HASH_ZERO_TREE(level + 1), level + 1, horiz * 2 + 1, totalwidth, buffer)
            }
        }
        else {
            this._drawNode(node, level, horiz, totalwidth, buffer);

            let subtree = this.TREE(node)

            if (subtree !== undefined) {
                this._drawTreeLevel(subtree[0], level + 1, horiz * 2, totalwidth, buffer)
                this._drawTreeLevel(subtree[1], level + 1, horiz * 2 + 1, totalwidth, buffer)
            }
        }
    }

    drawTree(): TreeBox {

        const WIDTH = Number((this.upperIndex() + 1n)) * NODE_WIDTH +
            Number(this.upperIndex()) * NODE_HSPACING + NEWLINE_LEN;

        const HEIGHT = NODE_HEIGHT * Number(this.LEVELS_TOTAL() + 1n) +
            NODE_VSPACING * Number(this.LEVELS_TOTAL());

        let line = ''.padEnd(WIDTH - NEWLINE_LEN, ' ') + NEWLINE;

        const bufferSize = Buffer.byteLength(line) * HEIGHT;
        const buffer = Buffer.alloc(bufferSize);

        for (let lineCnt = 0; lineCnt < HEIGHT; lineCnt++) {
            buffer.write(line, lineCnt * Buffer.byteLength(line), 'utf8');
        }

        this._drawTreeLevel(this.ROOT(), 0, 0, WIDTH, buffer);

        return {
            text: buffer.toString('utf8'),
            width: WIDTH,
            height: HEIGHT
        };
    }

    viewTree(offset: number, view: number, tree_data: TreeBox): string {

        if ((offset < 0) ||
            (view <= 1) ||  // View will always contain line termination LF
            (tree_data.width <= 0) ||
            (tree_data.height <= 0))
            throw "Invalid dimensions";

        if (view >= tree_data.width)
            return this._pretty ? this._prettify(tree_data.text) : tree_data.text;

        if (offset + view > tree_data.width)
            throw "Invalid dimensions";

        const buffer = Buffer.alloc(view * tree_data.height);

        for (let cnt = 0; cnt < tree_data.height; ++cnt) {
            let start = cnt * tree_data.width + offset;
            let end = start + view - 1;
            buffer.write(tree_data.text.substring(start, end) + NEWLINE, cnt * view, "utf8");
        }

        let viewText = buffer.toString('utf8');
        if (this._pretty) {
            return this._prettify(viewText);
        }

        return viewText;
    }
}
