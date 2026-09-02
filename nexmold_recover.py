import json
import itertools

materials = [
    "peek", "polycarbonate", "nylon66", "ultem", "pom", "abs", "abs-pc", "pps", "pmma", "pp",
    "pbt", "pbt-gf", "psu", "ppsu", "tpe", "tpu", "pvdf", "lcp", "pa6", "pa12",
    "pet", "pet-gf", "ldpe", "hdpe", "asa", "san", "pla", "pai", "pbi", "ptfe",
    "ps", "hips", "pes", "pvk", "petg", "cop", "coc", "pvc-rigid"
]

industries = [
    "vertical-farming", "countertop-ice-makers", "medical-consumables", 
    "ev-powertrain", "smart-home-security", "biotech-labware", "in-vitro-diagnostic",
    "aerospace-avionics", "premium-appliance", "kitchen-appliance-oem", "industrial-filtration"
]

components = [
    "surgical-trays", "hydroponic-housing", "anti-leak-water-tank", 
    "busbar-insulators", "valve-bodies", "fluidic-manifolds", "microfluidic-cartridges",
    "optical-test-cuvettes", "precision-gears", "sealed-access-covers", "filter-retainer-cages"
]

prefixes = ["custom", "precision", "oem", "heavy-duty", "high-tolerance"]

all_combinations = list(itertools.product(materials, industries, prefixes, components))

# 🌟 格式化为纯净的 Astro 静态路由矩阵对象数组
matrix_data = []
for mat, ind, pref, comp in all_combinations:
    matrix_data.append({
        "material": mat.lower(),
        "industry": ind.lower(),
        "component": f"{pref}-{comp}".lower()
    })

# 💾 直接暴力覆盖写进 src/data/moldingMatrix.json
output_path = 'src/data/moldingMatrix.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(matrix_data, f, indent=2, ensure_ascii=False)

print(f"✅ NEXMOLD 数字化合体成功！{len(matrix_data)} 条路由已注入 src/data/moldingMatrix.json！")
