#!/usr/bin/env python3
"""
Manual Plant Data Fill Script
Fills in known plant data that automated enrichment couldn't provide.
Only fills empty/NULL fields - never overwrites existing data.
"""

import sqlite3
import sys
import os
import shutil
from datetime import datetime


# Manual data keyed by plant ID
# Only includes fields that are typically empty after automated enrichment
PLANT_DATA = {
    # === FRUIT / FOOD PRODUCING PLANTS ===

    2: {  # Meyer Lemon
        "harvest_frequency": "Year-round when fruit turns yellow",
        "how_to_harvest": "Pick when fully yellow and slightly soft to touch. Twist gently or cut stem with pruners. Fruit can stay on tree for weeks after ripening.",
    },
    3: {  # Orange
        "water_schedule": "summer:5,winter:14,spring:7,fall:10",
        "fertilize_schedule": "spring:30,summer:30,fall:45,winter:0",
        "prune_frequency": "Prune after harvest to shape and remove dead wood",
        "prune_months": "Late winter, Early spring",
        "harvest_frequency": "Annually, winter through early spring",
        "how_to_harvest": "Pick when fully colored and slightly soft. Twist and pull, or cut with pruners. Ripe fruit stays on tree for weeks.",
        "produces_months": "Winter, Early spring",
        "grow_zones": "9-11",
        "moisture_preference": "MOIST",
        "soil_requirements": "Well-drained sandy loam; pH 6.0-7.0",
        "uses": "Fresh eating, juice, marmalade, cooking, zest for flavoring",
        "known_hazards": "Thorns on some varieties. All citrus parts toxic to cats and dogs.",
        "size_full_grown": "Height: 15-25 ft; Spread: 15-20 ft",
        "cultivation_details": "Full sun, protect from frost. Fertilize 3x per year with citrus fertilizer. Deep water weekly in summer. Mulch around base.",
    },
    4: {  # Blueberry
        "fertilize_schedule": "spring:30,summer:45,fall:0,winter:0",
        "harvest_frequency": "Daily picking for 2-3 weeks during season",
        "how_to_harvest": "Pick when berries are fully blue with no red or green. Gently roll berries off cluster. Ripe berries detach easily.",
        "known_hazards": "None. All parts non-toxic. Acidic soil required - iron chlorosis in alkaline soil.",
    },
    5: {  # Blackberry
        "water_schedule": "summer:3,winter:10,spring:5,fall:7",
        "fertilize_schedule": "spring:30,summer:0,fall:60,winter:0",
        "prune_frequency": "Remove fruited canes after harvest; tip-prune new canes in summer",
        "prune_months": "Late winter, After harvest",
        "harvest_frequency": "Every 2-3 days during season for 3-4 weeks",
        "how_to_harvest": "Pick when berries are fully black and pull easily from plant. Use shallow containers to avoid crushing.",
        "produces_months": "Late spring, Early summer, Mid summer",
        "moisture_preference": "MOIST",
        "known_hazards": "Thorns on most varieties. Can become invasive if not managed.",
        "cultivation_details": "Full sun. Train on trellis. Remove spent floricanes after fruiting. Tip-prune primocanes at 4 ft to encourage branching.",
    },
    6: {  # Fig
        "harvest_frequency": "Every 1-2 days during season",
        "how_to_harvest": "Pick when fruit droops on stem, is soft to touch, and skin begins to split. Wear gloves - fig sap can irritate skin.",
    },
    7: {  # Peach
        "fertilize_schedule": "spring:30,summer:45,fall:0,winter:0",
        "harvest_frequency": "Daily picking for 2-4 weeks",
        "how_to_harvest": "Pick when fruit gives slightly to gentle pressure and background color changes from green to yellow. Twist and lift upward.",
    },
    8: {  # Cassava
        "harvest_frequency": "8-12 months after planting",
        "how_to_harvest": "Cut stem 1 ft above ground, dig around root, pull up entire root system. Peel and cook within 24 hours - never eat raw.",
        "uses": "Starchy root vegetable. Boiled, fried, or made into flour (tapioca). Leaves edible when cooked thoroughly.",
    },
    9: {  # Turmeric
        "harvest_frequency": "7-10 months after planting when leaves yellow",
        "how_to_harvest": "Dig up rhizomes when foliage dies back. Wash, boil for 30-45 min, dry in sun. Or use fresh. Save some rhizomes for replanting.",
        "uses": "Culinary spice, anti-inflammatory medicinal use, natural dye, tea",
        "known_hazards": "Stains skin and clothing bright yellow. May interact with blood thinners.",
    },
    10: {  # Taro
        "harvest_frequency": "7-12 months after planting",
        "how_to_harvest": "Harvest when leaves start to yellow and wilt. Dig up corms carefully. MUST be cooked thoroughly - raw taro contains calcium oxalate crystals.",
    },
    11: {  # Banana
        "fertilize_schedule": "spring:14,summer:14,fall:30,winter:0",
        "harvest_frequency": "9-15 months from planting; cut whole bunch",
        "how_to_harvest": "Cut entire bunch when fingers are plump and ridges round out. Hang bunch upside down in shade to ripen. Cut mother plant to ground after harvest.",
        "known_hazards": "Sap stains clothing permanently. Pseudostem can fall when heavy with fruit.",
    },
    12: {  # Seabreeze Bamboo
        "water_schedule": "summer:3,winter:10,spring:5,fall:7",
        "fertilize_schedule": "spring:30,summer:30,fall:60,winter:0",
        "prune_frequency": "Remove dead culms annually; thin dense clumps",
        "prune_months": "Late winter, Early spring",
        "harvest_frequency": "N/A - ornamental/privacy screen",
        "how_to_harvest": "N/A - not typically harvested. Young shoots technically edible if cooked.",
        "produces_months": "N/A",
        "grow_zones": "9-11",
        "moisture_preference": "MOIST",
        "soil_requirements": "Rich, well-drained loam; tolerates sandy soil; pH 5.5-6.5",
        "uses": "Privacy screening, windbreak, erosion control, building material, ornamental",
        "known_hazards": "Clumping variety (non-invasive). Sharp leaf edges can cut skin.",
        "size_full_grown": "Height: 35-40 ft; Spread: 10-15 ft (clumping)",
        "cultivation_details": "Full sun to part shade. Water deeply and regularly first 2 years. Fertilize with high-nitrogen fertilizer in spring/summer. Remove dead culms at ground level.",
    },
    13: {  # Giant Timber Bamboo
        "fertilize_schedule": "spring:30,summer:30,fall:60,winter:0",
        "harvest_frequency": "N/A - ornamental. Shoots edible in spring.",
        "how_to_harvest": "Harvest young shoots when 6-12 inches tall in spring. Peel outer sheaths, boil 20 min before eating.",
        "moisture_preference": "MOIST",
        "soil_requirements": "Rich, moist, well-drained loam; pH 5.5-6.5",
        "uses": "Construction, furniture, ornamental, edible shoots, windbreak",
        "known_hazards": "Clumping variety (non-invasive). Raw shoots contain cyanogenic glycosides - must be boiled.",
    },
    14: {  # Chaya
        "harvest_frequency": "Continuous - pick leaves as needed year-round",
        "how_to_harvest": "Pick mature leaves from lower branches. MUST be boiled at least 20 minutes - raw leaves are toxic (hydrocyanic acid).",
        "uses": "Cooked green vegetable (like spinach). Very high in protein, iron, calcium, and vitamins.",
        "known_hazards": "TOXIC RAW - contains hydrocyanic glycosides. Must boil 20+ minutes. Do not cook in aluminum pots. Sap can irritate skin.",
    },
    15: {  # American Beautyberry
        "fertilize_schedule": "spring:60,summer:0,fall:0,winter:0",
        "harvest_frequency": "Once annually when berries turn purple",
        "how_to_harvest": "Pick berry clusters when fully purple in fall. Strip berries from stem. Used for jelly, wine, or dried.",
        "known_hazards": "Berries are mildly astringent raw but safe. Leaves are a natural insect repellent.",
    },
    16: {  # Avocado
        "fertilize_schedule": "spring:30,summer:30,fall:60,winter:0",
        "harvest_frequency": "Pick as needed once mature; fruit ripens off tree",
        "how_to_harvest": "Pick when fruit reaches full size and skin dulls slightly. Fruit ripens 5-7 days after picking at room temperature. Stem end test: if stem pops off easily and is green underneath, its ready.",
    },
    17: {  # Lemon Grass
        "harvest_frequency": "Continuous - cut stalks as needed",
        "how_to_harvest": "Cut or pull outer stalks at base when 12+ inches tall. Use the bottom 4-6 inches (white/pale portion). Peel outer tough layers.",
        "moisture_preference": "MOIST",
    },
    18: {  # Elderberry
        "harvest_frequency": "Annually in late summer",
        "how_to_harvest": "Cut entire berry clusters when most berries are dark purple/black. Strip berries from stems with a fork. MUST be cooked - raw berries and all other plant parts are toxic.",
    },
    19: {  # Muscadine Grape
        "fertilize_schedule": "spring:30,summer:0,fall:60,winter:0",
        "prune_months": "Late winter, Early spring (while dormant)",
        "harvest_frequency": "Every few days for 3-4 weeks",
        "how_to_harvest": "Pick individual grapes when they detach easily from cluster with a gentle tug. Muscadines ripen unevenly - pick individually, not in clusters.",
    },
    20: {  # Aloe Vera
        "prune_months": "Any time (remove dead outer leaves)",
        "harvest_frequency": "Cut outer leaves as needed for gel",
        "how_to_harvest": "Cut outermost leaves at base with clean knife. Slice leaf open and scrape gel. Let yellow latex drain first (aloin is a strong laxative).",
    },
    21: {  # Cuban Oregano
        "harvest_frequency": "Continuous - pick leaves as needed",
        "how_to_harvest": "Pinch or cut leaf stems as needed. Regular harvesting encourages bushier growth. Use fresh - flavor diminishes when dried.",
    },
    22: {  # Mango
        "fertilize_schedule": "spring:30,summer:45,fall:60,winter:0",
        "harvest_frequency": "Over 2-4 weeks when fruit matures",
        "how_to_harvest": "Pick when fruit color changes and flesh gives slightly to pressure. Cut stem with pruners leaving 1 inch stem. Fruit continues ripening off tree.",
        "known_hazards": "Sap and skin contain urushiol (like poison ivy) - can cause allergic dermatitis. Wear gloves when handling.",
    },
    23: {  # Pigeon Pea
        "fertilize_schedule": "spring:60,summer:0,fall:0,winter:0",
        "harvest_frequency": "Continuous harvest over several months",
        "how_to_harvest": "Pick green pods when plump for fresh peas. Let pods dry on plant for dried peas. Plant is a nitrogen fixer - minimal fertilizer needed.",
        "produces_months": "Late summer, Fall, Early winter",
        "uses": "Fresh or dried peas for cooking, dal, rice dishes. Nitrogen-fixing cover crop. Animal fodder.",
        "known_hazards": "None significant. Seeds may cause flatulence.",
        "size_full_grown": "Height: 4-10 ft; Spread: 3-5 ft",
    },
    24: {  # Blue Butterfly Pea
        "harvest_frequency": "Continuous - pick flowers daily",
        "how_to_harvest": "Pick flowers in morning when fully open. Use fresh for tea or dry in shade. Pick seed pods when brown and dry for replanting.",
    },
    25: {  # Cowpea
        "fertilize_schedule": "spring:60,summer:0,fall:0,winter:0",
        "harvest_frequency": "Pick green pods every 2-3 days",
        "how_to_harvest": "Pick green pods when beans are visible but pods are still tender. For dried beans, leave pods on plant until brown and crispy.",
        "uses": "Fresh green pods, shelled peas, dried beans. Nitrogen-fixing cover crop. Young leaves edible cooked.",
        "known_hazards": "None significant.",
        "size_full_grown": "Height: 2-3 ft (bush) or 6-8 ft (vine); Spread: 2-3 ft",
    },
    26: {  # Moringa
        "harvest_frequency": "Continuous - leaves, pods, flowers year-round",
        "how_to_harvest": "Pick leaflets from compound leaves. Harvest drumstick pods when 12-18 inches long and still green. Cut branches to encourage bushy growth.",
        "known_hazards": "Root bark contains toxic alkaloids - avoid eating roots. Excessive consumption of leaves may lower blood pressure.",
    },
    27: {  # Dwarf Everbearing Mulberry
        "harvest_frequency": "Daily picking for 2-3 months",
        "how_to_harvest": "Shake branches over a tarp or sheet - ripe berries fall easily. Or pick by hand when fully dark. Berries stain everything.",
        "uses": "Fresh eating, jams, pies, wine, dried. Leaves can be used for tea.",
    },
    28: {  # Thai Mulberry
        "harvest_frequency": "Daily picking for 2-3 months",
        "how_to_harvest": "Pick when berries are fully dark (black, purple, or white depending on variety). Gently pull from stem. Very fragile - handle carefully.",
    },
    29: {  # Pink Guava
        "fertilize_schedule": "spring:30,summer:30,fall:60,winter:0",
        "harvest_frequency": "Over several weeks as fruit ripens",
        "how_to_harvest": "Pick when skin turns from green to yellow and fruit gives to gentle pressure. Strong sweet aroma when ripe. Can ripen on counter if picked slightly green.",
        "produces_months": "Summer, Fall",
        "known_hazards": "Seeds are very hard - can damage teeth. Some people are allergic.",
    },
    30: {  # Yellow Guava
        "fertilize_schedule": "spring:30,summer:30,fall:60,winter:0",
        "harvest_frequency": "Over several weeks as fruit ripens",
        "how_to_harvest": "Pick when skin turns yellow and fruit gives to gentle pressure. Strong sweet aroma when ripe. Can ripen on counter if picked slightly green.",
        "produces_months": "Summer, Fall",
        "known_hazards": "Seeds are very hard - can damage teeth. Some people are allergic.",
    },
    31: {  # Loquat
        "water_schedule": "summer:7,winter:14,spring:10,fall:10",
        "fertilize_schedule": "spring:30,summer:0,fall:30,winter:0",
        "prune_frequency": "Light pruning after harvest to shape; thin fruit clusters",
        "prune_months": "After harvest (spring)",
        "harvest_frequency": "Over 2-3 weeks in spring",
        "how_to_harvest": "Pick when fruit is fully colored (yellow-orange) and slightly soft. Twist and pull, or cut cluster with pruners. Peel skin, remove seeds.",
        "produces_months": "Late winter, Early spring, Mid spring",
        "grow_zones": "8-11",
        "moisture_preference": "MOIST",
        "soil_requirements": "Well-drained loam or sandy soil; tolerates clay; pH 5.5-7.5",
        "uses": "Fresh eating, jams, jellies, pies, wine. Seeds contain small amounts of cyanogenic compounds.",
        "known_hazards": "Seeds contain amygdalin (cyanide precursor) - do not eat seeds. Otherwise non-toxic.",
        "size_full_grown": "Height: 15-25 ft; Spread: 15-20 ft",
        "cultivation_details": "Full sun to part shade. Drought tolerant once established. Thin fruit clusters to 4-6 fruits for larger fruit. Protect from hard freezes.",
    },
    32: {  # Lychee
        "harvest_frequency": "Over 2-3 weeks annually",
        "how_to_harvest": "Cut fruit clusters with pruners when skin turns red/pink and bumpy texture smooths. Do not pull individual fruits. Eat within a few days - lychee does not ripen further after picking.",
        "produces_months": "Late spring, Early summer",
        "uses": "Fresh eating, desserts, dried (lychee nuts), cocktails, jams",
        "known_hazards": "Seeds are toxic - do not eat. Unripe fruit may cause hypoglycemia in children on empty stomach.",
    },
    33: {  # Ginger
        "harvest_frequency": "8-10 months after planting",
        "how_to_harvest": "Dig up rhizomes when foliage yellows and dies back. For baby ginger, harvest at 4-6 months (milder flavor). Wash and use fresh or dry.",
        "uses": "Culinary spice (fresh, dried, powdered), tea, anti-nausea remedy, anti-inflammatory",
        "known_hazards": "May interact with blood thinners. Can cause heartburn in large quantities.",
    },
    34: {  # Pomelo
        "water_schedule": "summer:5,winter:14,spring:7,fall:10",
        "fertilize_schedule": "spring:30,summer:30,fall:60,winter:0",
        "prune_frequency": "Minimal - remove dead wood and water sprouts",
        "prune_months": "After harvest (spring)",
        "harvest_frequency": "Annually, winter through early spring",
        "how_to_harvest": "Pick when fruit is heavy for size and skin turns yellow-green to yellow. Cut stem with pruners. Peel thick rind, separate segments.",
        "produces_months": "Winter, Early spring",
        "grow_zones": "9-11",
        "moisture_preference": "MOIST",
        "soil_requirements": "Well-drained sandy loam; pH 5.5-6.5; needs good drainage",
        "uses": "Fresh eating, salads, juice, candied peel, marmalade",
        "known_hazards": "Like grapefruit, pomelo interacts with certain medications (statins, blood pressure drugs). Toxic to cats and dogs.",
        "size_full_grown": "Height: 15-25 ft; Spread: 10-15 ft",
        "cultivation_details": "Full sun. Water deeply and regularly. Fertilize with citrus fertilizer 3x per year. Protect from frost. Mulch around base but keep away from trunk.",
    },
    35: {  # Neem Tree
        "fertilize_schedule": "spring:60,summer:60,fall:0,winter:0",
        "harvest_frequency": "Leaves year-round; fruit annually",
        "how_to_harvest": "Pick leaves any time for tea or pest spray. Harvest fruit when it turns yellow. Seeds used for neem oil extraction.",
    },
    36: {  # Dragon Fruit
        "prune_months": "Early spring, After harvest",
        "harvest_frequency": "30-50 days after flowering; multiple cycles per year",
        "how_to_harvest": "Pick when skin color changes from green to pink/red and wing tips start to wither. Twist fruit gently or cut stem. Flesh should be white or red with black seeds.",
        "known_hazards": "Spines on stems can cause injury. Some people experience mild allergic reactions.",
    },
    37: {  # Jackfruit
        "fertilize_schedule": "spring:30,summer:30,fall:60,winter:0",
        "harvest_frequency": "3-8 months from flowering; multiple fruits per year",
        "how_to_harvest": "Ripe when skin turns from green to yellow-brown, gives slightly to pressure, and smells sweet. Cut stem with machete. Oil hands and knife before cutting open - latex is very sticky.",
        "uses": "Fresh fruit (sweet), unripe fruit as vegetable (like pulled pork texture), seeds roasted or boiled, wood for furniture",
        "known_hazards": "Latex sap is very sticky and hard to remove. Can cause allergic reactions in people with birch pollen or latex allergy.",
        "size_full_grown": "Height: 30-60 ft; Spread: 20-30 ft",
    },
    38: {  # Mysore Raspberry
        "harvest_frequency": "Every 2-3 days during season",
        "how_to_harvest": "Pick when berries are fully dark purple/black and pull easily from plant. Very fragile - use shallow containers.",
        "uses": "Fresh eating, jams, jellies, pies, smoothies",
        "known_hazards": "Can be invasive in tropical climates. Thorny canes.",
    },
    40: {  # Canistel
        "harvest_frequency": "Over several weeks as fruit ripens",
        "how_to_harvest": "Pick when skin turns bright orange-yellow and fruit gives to gentle pressure. Let ripen at room temperature for 3-7 days after picking until soft. Flesh is dry and dense like cooked egg yolk.",
        "produces_months": "Fall, Winter, Early spring",
        "known_hazards": "Seeds are toxic - do not eat. Unripe fruit is astringent and inedible.",
    },

    # === ORNAMENTAL / HOUSEPLANTS (no harvest) ===

    44: {  # Mother-in-Law's Tongue
        "prune_months": "Any time (remove damaged leaves)",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
    },
    46: {  # Monstera
        "harvest_frequency": "N/A (fruit rarely produced indoors)",
        "how_to_harvest": "N/A - fruit only produced on mature outdoor plants in tropics. If fruit appears, harvest when scales begin to separate. Unripe fruit contains oxalic acid - toxic.",
    },
    53: {  # Rubber Tree
        "fertilize_schedule": "spring:30,summer:30,fall:60,winter:0",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
    },
    54: {  # White Bird of Paradise
        "fertilize_schedule": "spring:30,summer:30,fall:0,winter:0",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant. Flowers can be cut for arrangements.",
        "known_hazards": "All parts toxic to cats and dogs if ingested (GI irritation).",
    },
    55: {  # Giant Elephant Ear
        "water_schedule": "summer:3,winter:10,spring:5,fall:7",
        "fertilize_schedule": "spring:14,summer:14,fall:30,winter:0",
        "prune_frequency": "Remove dead or damaged leaves as needed",
        "prune_months": "Any time",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant. Corms technically edible but must be cooked thoroughly.",
        "produces_months": "N/A",
        "uses": "Ornamental, tropical landscaping accent, container plant",
        "known_hazards": "All parts contain calcium oxalate crystals - toxic if eaten raw. Sap can irritate skin.",
        "cultivation_details": "Part shade to full shade. Needs consistently moist soil. Heavy feeder - fertilize every 2 weeks in growing season. Protect from wind.",
    },
    56: {  # Elephant Ear Portora
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
    },
    57: {  # Cast Iron Plant
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
        "produces_months": "N/A",
        "known_hazards": "Non-toxic to pets and humans.",
    },
    58: {  # ZZ Plant
        "fertilize_schedule": "spring:60,summer:60,fall:0,winter:0",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
    },
    59: {  # Boston Fern
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
        "produces_months": "N/A",
        "known_hazards": "Non-toxic to pets and humans. May trigger allergies in some people.",
    },
    60: {  # Majesty Palm
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
        "uses": "Indoor ornamental palm, tropical landscaping",
        "known_hazards": "Non-toxic to pets and humans.",
    },
    61: {  # Spider Plant
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant. Propagate by planting baby plantlets (spiderettes).",
        "known_hazards": "Non-toxic to humans. Mildly hallucinogenic to cats (similar to catnip effect).",
    },
    62: {  # Frangipani
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant. Flowers used for leis and fragrance.",
    },
    64: {  # Variegated American Aloe
        "prune_months": "Any time (remove dead lower leaves)",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental agave. Produces flower stalk once after 10-30 years then dies (monocarpic).",
    },
    65: {  # Scarlet-star
        "fertilize_schedule": "spring:30,summer:30,fall:0,winter:0",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental bromeliad. Produces pups after flowering which can be separated.",
        "known_hazards": "Non-toxic to pets and humans.",
    },
    66: {  # Golden pothos
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant. Propagate by cutting below a node and rooting in water.",
    },
    67: {  # Purple heart
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant. Sap may irritate skin.",
    },
    68: {  # Ghost plant
        "prune_months": "Spring (remove leggy growth)",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental succulent. Propagate from fallen leaves or stem cuttings.",
        "known_hazards": "Non-toxic to pets and humans.",
    },
    69: {  # White azalea
        "fertilize_schedule": "spring:30,summer:0,fall:30,winter:0",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental flowering shrub",
        "produces_months": "Spring",
        "uses": "Ornamental flowering shrub, foundation planting, borders",
        "known_hazards": "ALL parts highly toxic (grayanotoxins). Toxic to humans, dogs, cats, and livestock. Even honey from azalea nectar can be toxic.",
        "size_full_grown": "Height: 3-6 ft; Spread: 3-6 ft",
    },
    70: {  # Night-Scented Lily (Alocasia odora)
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
    },
    71: {  # Peanut cactus
        "prune_months": "After flowering (spring/summer)",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental cactus. Propagate by separating offsets.",
        "known_hazards": "Spines can cause injury. Otherwise non-toxic.",
    },
    72: {  # Beautiful graptopetalum
        "prune_months": "Spring (remove leggy growth)",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental succulent",
        "uses": "Ornamental succulent, rock gardens, containers",
        "known_hazards": "Non-toxic to pets and humans.",
    },
    73: {  # Coppertone sedum
        "fertilize_schedule": "spring:60,summer:0,fall:0,winter:0",
        "prune_months": "Spring (shape and remove leggy growth)",
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental succulent",
        "known_hazards": "Non-toxic to humans. Mildly toxic to cats and dogs if ingested.",
    },
    74: {  # Heartleaf philodendron
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
    },
    75: {  # Peace lily
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant. Flowers can be cut for arrangements.",
        "moisture_preference": "MOIST",
    },
    76: {  # Mason congo Victoria
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
        "uses": "Indoor ornamental, architectural accent plant",
        "known_hazards": "Mildly toxic if ingested (saponins). Can cause nausea and vomiting in pets.",
    },
    77: {  # Arrowhead plant
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
    },
    78: {  # Monstera obliqua
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant. Very rare and slow-growing.",
    },
    79: {  # Philodendron Imperial Green
        "harvest_frequency": "N/A",
        "how_to_harvest": "N/A - ornamental plant",
        "uses": "Indoor ornamental, air purifier, tropical accent",
    },
}


def backup_database(db_path):
    """Create a timestamped backup before making changes."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.backup_manual_{timestamp}"
    print(f"Creating backup: {backup_path}")
    shutil.copy2(db_path, backup_path)
    backup_size = os.path.getsize(backup_path)
    print(f"Backup verified ({backup_size:,} bytes)")
    return backup_path


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "/opt/levi/backend/data/levi.db"
    dry_run = "--dry-run" in sys.argv

    print(f"Database: {db_path}")
    if dry_run:
        print("MODE: DRY RUN")
    print()

    if not dry_run:
        backup_path = backup_database(db_path)
        print()

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    c = conn.cursor()

    total_updated = 0
    total_fields = 0

    for plant_id, data in sorted(PLANT_DATA.items()):
        # Get plant name
        c.execute("SELECT name FROM plants WHERE id = ?", (plant_id,))
        row = c.fetchone()
        if not row:
            print(f"[{plant_id}] NOT FOUND - skipping")
            continue

        name = row[0]

        # Get current values for these fields
        field_names = list(data.keys())
        cols = ", ".join('"' + f + '"' for f in field_names)
        c.execute(f"SELECT {cols} FROM plants WHERE id = ?", (plant_id,))
        current = c.fetchone()

        updates = {}
        for i, field in enumerate(field_names):
            current_val = current[i]
            new_val = data[field]
            # Only fill empty fields
            if new_val is not None and (current_val is None or current_val == ""):
                updates[field] = new_val

        if updates:
            if dry_run:
                print(f"[{plant_id}] {name}:")
                for k, v in updates.items():
                    preview = str(v)[:70]
                    print(f"  {k} = {preview}")
            else:
                set_clause = ", ".join('"' + k + '" = ?' for k in updates.keys())
                values = list(updates.values()) + [plant_id]
                try:
                    c.execute(f'UPDATE plants SET {set_clause} WHERE id = ?', values)
                    conn.commit()
                    print(f"[{plant_id}] {name}: {len(updates)} fields updated")
                except Exception as e:
                    print(f"[{plant_id}] {name}: ERROR - {e}")
                    conn.rollback()
                    continue

            total_updated += 1
            total_fields += len(updates)
        else:
            print(f"[{plant_id}] {name}: no empty fields to fill")

    conn.close()

    print()
    print(f"=== RESULTS ===")
    if dry_run:
        print("(DRY RUN - no changes were made)")
    print(f"Plants updated: {total_updated}")
    print(f"Total fields filled: {total_fields}")
    if not dry_run:
        print(f"Backup at: {backup_path}")


if __name__ == "__main__":
    main()
