#!/usr/bin/env python
"""Draw the pixel-art block strips used by the site theme (assets/img/sift_*.png).

The tiles are original: 16x16 blocks of pink stone under turquoise soul-grass, drawn
from a fixed seed so the files are reproducible. PIL is needed.

    python scripts/make_sift_tiles.py
"""
import os
import random

from PIL import Image

TILE = 16
COLS = 8
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img')

STONE = [(0xd8, 0x5f, 0xa8), (0xc2, 0x4c, 0x97), (0xe5, 0x7b, 0xb9), (0xa9, 0x3d, 0x86)]
STONE_DEEP = [(0x8a, 0x2f, 0x73), (0x76, 0x27, 0x66), (0x9c, 0x3a, 0x80), (0x62, 0x1f, 0x58)]
GRASS = [(0x3f, 0xe0, 0xd0), (0x2b, 0xc4, 0xbb), (0x7d, 0xf5, 0xe6), (0x1f, 0xa3, 0xa3)]
BONE = (0xf3, 0xe6, 0xd3)
GLOW = (0xd9, 0xff, 0xf8)


def block(rng, palette, weights=(6, 3, 2, 2)):
    """A mottled 16x16 block with a darker lower and right edge."""
    px = [[rng.choices(palette, weights)[0] for _ in range(TILE)] for _ in range(TILE)]
    for i in range(TILE):
        px[TILE - 1][i] = palette[3]
        px[i][TILE - 1] = palette[3]
    return px


def grass_block(rng):
    px = block(rng, STONE)
    for x in range(TILE):
        depth = rng.choice((3, 4, 4, 5, 6))
        for y in range(depth):
            px[y][x] = rng.choices(GRASS, (6, 3, 2, 2))[0]
        px[0][x] = rng.choice((GRASS[0], GRASS[2]))
    for _ in range(2):
        px[rng.randrange(1, 3)][rng.randrange(TILE)] = GLOW
    return px


def deep_block(rng):
    px = block(rng, STONE_DEEP)
    if rng.random() < 0.6:
        x, y = rng.randrange(2, TILE - 4), rng.randrange(3, TILE - 4)
        for dx, dy in ((0, 0), (1, 0), (1, 1), (2, 1)):
            px[y + dy][x + dx] = BONE
    return px


def strip(name, rows, seed):
    rng = random.Random(seed)
    img = Image.new('RGB', (TILE * COLS, TILE * len(rows)))
    for r, make in enumerate(rows):
        for c in range(COLS):
            px = make(rng)
            for y in range(TILE):
                for x in range(TILE):
                    img.putpixel((c * TILE + x, r * TILE + y), px[y][x])
    path = os.path.normpath(os.path.join(OUT, name))
    img.save(path, optimize=True)
    print(path, img.size)


if __name__ == '__main__':
    strip('sift_ground.png', [grass_block, deep_block], seed=2027)
    strip('sift_deep.png', [deep_block], seed=14)
