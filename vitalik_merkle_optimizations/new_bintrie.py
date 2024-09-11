from ethereum.utils import sha3, encode_hex

# Comments by Alexander Zammit
# Key:Value mapping, 
# key = parent hash
# value = concatenated siblings
class EphemDB():
    def __init__(self, kv=None):
        self.kv = kv or {}

    def get(self, k):
        return self.kv.get(k, None)

    def put(self, k, v):
        self.kv[k] = v

    def delete(self, k):
        del self.kv[k]

# Initializes the zero subtree hashes
# Ultimately element zero will be the root
# ...and the last element zerohashes[256] will be the zero leaf.
# zerohashes[256] = 0x000000000...
# zerohashes[255] = sha3(zerohashes[256] + zerohashes[256])
# zerohashes[254] = sha3(zerohashes[255] + zerohashes[255])
zerohashes = [b'\x00' * 32]
for i in range(256):
    zerohashes.insert(0, sha3(zerohashes[0] + zerohashes[0]))

# Initializes the db (an instance of EphemDB)
# With an empty, all-zero tree having 256 levels
def new_tree(db):
    h = b'\x00' * 32
    for i in range(256):
        newh = sha3(h + h)
        db.put(newh, h + h)
        h = newh
    return h

# Application is working with an array of bytes
# A 256-bit path is constructed from a key composed 
# of a 32x1-byte array. 
# Function simply converts from 32-bytes array to 
# one 256-bit value
def key_to_path(k):
    o = 0
    for c in k:
        o = (o << 8) + c
    return o

# Traverse tree from root to the end of the path
# by following the provided path. The path is just 
# a set of left/right flags telling us which sibling 
# to pick. Returns node value at the path end.
def descend(db, root, *path):
    v = root
    for p in path:
        if p:
            v = db.get(v)[32:]
        else:
            v = db.get(v)[:32]
    return v

# Similar to descend, but this time the path
# is derived from the key hance we always end
# up to the leaf level.
def get(db, root, key):
    v = root
    path = key_to_path(key)
    for i in range(256):
        if (path >> 255) & 1:
            v = db.get(v)[32:]
        else:
            v = db.get(v)[:32]
        path <<= 1
    return v

# Update leaf value.
# The function adds all the new nodes
# that result from changing a leaf value.
# The function does not delete orphaned nodes.
# Function performs two pases. In the first 
# pass it identifies the siblings relevant
# to computing the new node hashes.
# In the second pass it adds th new nodes.
def update(db, root, key, value):
    v = root
    path = path2 = key_to_path(key)
    sidenodes = []
    for i in range(256):
        if (path >> 255) & 1:
            sidenodes.append(db.get(v)[:32])
            v = db.get(v)[32:]
        else:
            sidenodes.append(db.get(v)[32:])
            v = db.get(v)[:32]
        path <<= 1
    v = value
    for i in range(256):
        if (path2 & 1):
            newv = sha3(sidenodes[-1] + v)
            db.put(newv, sidenodes[-1] + v)
        else:
            newv = sha3(v + sidenodes[-1])
            db.put(newv, v + sidenodes[-1])
        path2 >>= 1
        v = newv
        sidenodes.pop()
    return v

# Returns an array of siblings necessary to
# proving membership. Siblings are collected
# by traversing from root to leaf and the
# returned array is ordered [root-1 -> leaf]
def make_merkle_proof(db, root, key):
    v = root
    path = key_to_path(key)
    sidenodes = []
    for i in range(256):
        if (path >> 255) & 1:
            sidenodes.append(db.get(v)[:32])
            v = db.get(v)[32:]
        else:
            sidenodes.append(db.get(v)[32:])
            v = db.get(v)[:32]
        path <<= 1
    return sidenodes

# Verify proof by recomputing root from the
# proof which is just an array of siblings.
def verify_proof(proof, root, key, value):
    path = key_to_path(key)
    v = value
    for i in range(256):
        if (path & 1):
            newv = sha3(proof[-1-i] + v)
        else:
            newv = sha3(v + proof[-1-i])
        path >>= 1
        v = newv
    return root == v

# Compress the proof by removing all zero hashes
# and adding a 256-bit (8*32-bytes) to identify
# which of the elments where removed.
def compress_proof(proof):
    bits = bytearray(32)
    oproof = b''
    for i, p in enumerate(proof):
        if p == zerohashes[i+1]:
            bits[i // 8] ^= 1 << i % 8
        else:
            oproof += p
    return bytes(bits) + oproof

# Recover full proof by re-inserting zero hashes
# This uses the 256-bit flags to identify the missing
# hashes. Function ouputs a new proof which is a merge
# of the compressed proof hashes and the newly inserted
# zero hashes
def decompress_proof(oproof):
    proof = []
    bits = bytearray(oproof[:32])
    pos = 32
    for i in range(256):
        if bits[i // 8] & (1 << (i % 8)):
            proof.append(zerohashes[i+1])
        else:
            proof.append(oproof[pos: pos + 32])
            pos += 32
    return proof
