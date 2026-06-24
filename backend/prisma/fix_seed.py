import re

with open(r"C:\Users\anshg\.gemini\antigravity\scratch\warehouse-ai\backend\prisma\seed.ts", "r") as f:
    content = f.read()

# Pattern to replace prisma.model.createMany({ data: [ ... ] })
# with Promise.all([ ... ].map(d => prisma.model.create({ data: d })))

def replace_create_many(match):
    model = match.group(1)
    data_array = match.group(2)
    return f"await Promise.all({data_array}.map(d => prisma.{model}.create({{ data: d }})))"

# This regex matches `await prisma.<model>.createMany({\n    data: <array>\n  });`
# We use a greedy match for the array because it can contain nested structures, but we have to be careful.
# Since python regex for balanced brackets is hard, I will just do simple replacements or I'll just rewrite seed.ts manually since I don't want to break it.
