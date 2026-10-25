"""
Blender backend for 3D portrait generation.

Produces raw, uncompressed .glb portrait busts (low-poly,
flat-shaded, no textures) that feed the conversion
pipeline:

  blender --background --python tools/blender/generate_portraits.py -- ^
      --region 03_western_europe_nordics --gender women --count 3

  node tools/convert-portraits-3d.mjs --region 03_western_europe_nordics ^
      --gender women --src "models/raw/03_western_europe_nordics/women"

Mirrors the procedural Node backend
(tools/generate-portraits-3d.mjs): both build the same
parametric bust, so models from either backend are
interchangeable. Use this script when authoring final
artwork in Blender; the Node backend exists for CI and
for machines without Blender.

Models are stylized mannequin busts — placeholders that
exercise the whole pipeline (generation -> conversion ->
manifest -> R3F render) before final artwork lands.

Safety: the same as the 2D pipeline — subjects are always
adults (the game's age range is 18-60).

Requires Blender 3.6+ (tested API: bpy.ops.mesh primitives,
bpy.ops.export_scene.gltf).
"""

import argparse
import math
import os
import random
import sys

import bpy

GENDERS = ("women", "men", "trans")
DEFAULT_COUNT = 3
DEFAULT_SEED = 42
DEFAULT_OUT = "models/raw"

# Skin tones are hex colors; palettes are coarse and
# region-aware without claiming to be exhaustive.
SKIN_PALETTES = {
    "default": ["#f5d0b0", "#eec39a", "#e0aa7e", "#d69a68"],
    "africa": ["#8d5a3b", "#7a4a2e", "#6b3d26", "#9c6a45"],
    "eastAsia": ["#f2d4b8", "#e8c39e", "#dbb285", "#f5dcc0"],
    "southAsia": ["#c98e5f", "#b87a4e", "#a06a42", "#d9a06e"],
    "nordics": ["#f8dcc0", "#f0c8a4", "#e6b48c", "#fbdcc4"],
}

HAIR_COLORS = [
    "#2b2b2b", "#4a3220", "#6e4a2f", "#8a6a45", "#b0906a",
    "#3a3a3a", "#5c5c5c", "#7a7a7a", "#a0a0a0", "#c0c0c0",
    "#5a3a28", "#7a4a2a", "#26221f",
]

EYE_COLORS = ["#3b2f2f", "#4a3a2a", "#2f3a4a", "#3a4a3a", "#5a4632"]

# Hair style pools per gender (weighted by repetition).
HAIR_STYLES = {
    "women": ["long", "long", "bun", "ponytail", "curly", "long"],
    "men": ["short", "short", "short", "bald", "curly"],
    "trans": ["short", "long", "bun", "ponytail", "curly", "short"],
}


def skin_palette(region_id):
    if region_id[:2] in ("06", "07", "08", "09"):
        return SKIN_PALETTES["africa"]
    if region_id[:2] in ("11", "13"):
        return SKIN_PALETTES["eastAsia"]
    if region_id[:2] == "12":
        return SKIN_PALETTES["southAsia"]
    if region_id[:2] in ("03", "14"):
        return SKIN_PALETTES["nordics"]
    return SKIN_PALETTES["default"]


def hex_to_linear_rgba(hex_color):
    """Blender's Principled BSDF takes linear-space RGBA."""
    r = int(hex_color[1:3], 16) / 255.0
    g = int(hex_color[3:5], 16) / 255.0
    b = int(hex_color[5:7], 16) / 255.0
    return (math.pow(r, 2.2), math.pow(g, 2.2), math.pow(b, 2.2), 1.0)


def make_material(name, hex_color):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = hex_to_linear_rgba(hex_color)
        bsdf.inputs["Roughness"].default_value = 0.9
    mat.diffuse_color = hex_to_linear_rgba(hex_color)
    return mat


def flat_shade(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = False


def add_sphere(name, radius, segments, rings, location, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_sphere_add(
        radius=radius, segments=segments, ring_count=rings, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    flat_shade(obj)
    return obj


def add_cylinder(name, radius_top, radius_bottom, depth, vertices, location, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        radius1=radius_top,
        radius2=radius_bottom,
        depth=depth,
        vertices=vertices,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    flat_shade(obj)
    return obj


def add_cone(name, radius, depth, vertices, location, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(
        radius1=radius, depth=depth, vertices=vertices,
        location=location, rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    flat_shade(obj)
    return obj


def add_hair(style, hair_mat, head_obj):
    cap = add_sphere(
        "hair_cap", 0.54, 12, 8,
        head_obj.location, hair_mat,
        scale=(head_obj.scale.x * 1.02, head_obj.scale.y * 1.02, head_obj.scale.z * 1.02),
    )
    # Half dome: drop the lower half of the cap.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(
        plane_co=(0, 0, head_obj.location.z),
        plane_no=(0, 0, -1),
        clear_inner=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")

    if style == "long":
        add_cylinder("hair_back", 0.34, 0.42, 1.1, 10, (0, -0.28, 1.05), hair_mat)
    elif style == "bun":
        add_sphere("hair_bun", 0.18, 8, 6, (0, -0.3, 2.15), hair_mat)
    elif style == "ponytail":
        add_cylinder("hair_tail", 0.09, 0.05, 0.85, 8, (0, -0.45, 1.95), hair_mat, rotation=(-0.5, 0, 0))
    elif style == "curly":
        for i in range(9):
            angle = (i / 9) * math.pi * 2
            add_sphere(
                f"hair_curl_{i}", 0.13, 7, 5,
                (math.cos(angle) * 0.5, math.sin(angle) * 0.5, 1.85 + math.sin(i * 2.3) * 0.18),
                hair_mat,
            )
    elif style == "bald":
        bpy.data.objects.remove(cap, do_unlink=True)
    # "short" keeps just the cap.


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for b in block:
            if b.users == 0:
                block.remove(b)


def build_bust(rng, gender, region_id):
    clear_scene()

    skin_hex = rng.choice(skin_palette(region_id))
    hair_hex = rng.choice(HAIR_COLORS)
    eye_hex = rng.choice(EYE_COLORS)

    skin_mat = make_material("skin", skin_hex)
    hair_mat = make_material("hair", hair_hex)
    eye_mat = make_material("eyes", eye_hex)

    def jitter(value, amount=0.08):
        return value * (1 + (rng.random() * 2 - 1) * amount)

    # Head: low-segment sphere, slightly egg-shaped.
    head = add_sphere(
        "head", 0.5, 14, 10, (0, 0, 1.55), skin_mat,
        scale=(jitter(1.0), jitter(1.22), jitter(1.05)),
    )
    # Neck.
    add_cylinder("neck", 0.16, 0.21, 0.4, 10, (0, 0, 1.02), skin_mat)
    # Shoulders / upper chest: tapered cylinder.
    add_cylinder(
        "shoulders", jitter(0.92, 0.1), jitter(0.42, 0.08), jitter(0.62, 0.1),
        12, (0, 0, 0.36), skin_mat,
    )
    # Face hints: eyes + nose.
    for side in (-1, 1):
        add_sphere(f"eye_{side}", 0.055, 8, 6, (side * 0.17, 0.42, 1.62), eye_mat)
    add_cone("nose", 0.06, 0.18, 6, (0, 0.52, 1.5), skin_mat, rotation=(math.pi / 2, 0, 0))
    # Hair.
    add_hair(rng.choice(HAIR_STYLES[gender]), hair_mat, head)


def export_glb(filepath):
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )


def parse_args(argv):
    # Blender passes everything after "--" to the script.
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    parser = argparse.ArgumentParser(
        description="Procedural 3D portrait generator (Blender backend)"
    )
    parser.add_argument("--region", default="03_western_europe_nordics",
                        help="comma-separated region folder ids")
    parser.add_argument("--gender", default="all",
                        help="women | men | trans | all")
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--out", default=DEFAULT_OUT)
    return parser.parse_args(argv)


def main():
    args = parse_args(sys.argv)

    region_ids = [r.strip() for r in args.region.split(",") if r.strip()]
    genders = GENDERS if args.gender == "all" else (args.gender,)
    for gender in genders:
        if gender not in GENDERS:
            raise SystemExit(f"error: --gender must be one of {', '.join(GENDERS)}, all")

    generated = 0
    for region_id in region_ids:
        for gender in genders:
            out_dir = os.path.join(args.out, region_id, gender)
            os.makedirs(out_dir, exist_ok=True)
            for i in range(args.count):
                rng = random.Random(args.seed + generated * 7919)
                build_bust(rng, gender, region_id)
                filepath = os.path.join(out_dir, f"raw_{i + 1:03d}.glb")
                export_glb(filepath)
                generated += 1
                size_kb = os.path.getsize(filepath) / 1024
                print(f"generated {os.path.join(region_id, gender, f'raw_{i + 1:03d}.glb')} ({size_kb:.1f} KB)")

    print(f"\ndone: {generated} raw models in {os.path.abspath(args.out)}")
    print("next: node tools/convert-portraits-3d.mjs --region <id> --gender <g> --src <out>/<region>/<gender>")


if __name__ == "__main__":
    main()
