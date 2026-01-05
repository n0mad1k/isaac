"""
Plant Data Import Service
Fetches and parses plant data from external sources (PFAF, Permapeople)
"""

import re
import httpx
from bs4 import BeautifulSoup
from typing import Optional, Dict, Any, List, Set
from loguru import logger
from urllib.parse import urlparse, parse_qs


# PFAF references cache - loaded once per session
_pfaf_references_cache: Dict[str, str] = {}


def celsius_to_fahrenheit(celsius: float) -> float:
    """Convert Celsius to Fahrenheit."""
    return round(celsius * 9/5 + 32, 1)


def meters_to_feet(meters: float) -> float:
    """Convert meters to feet."""
    return round(meters * 3.28084, 1)


def cm_to_inches(cm: float) -> float:
    """Convert centimeters to inches."""
    return round(cm / 2.54, 1)


def mm_to_inches(mm: float) -> float:
    """Convert millimeters to inches."""
    return round(mm / 25.4, 2)


def kg_to_lbs(kg: float) -> float:
    """Convert kilograms to pounds."""
    return round(kg * 2.20462, 1)


def convert_metric_measurements(text: str) -> str:
    """
    Convert metric measurements in text to imperial (US units).
    Strips out metric values entirely, keeping only imperial.
    Handles: meters, centimeters, millimeters, celsius, kilograms.
    """
    if not text:
        return text

    # First, handle existing "X m (Yft)" patterns - extract just the ft value
    # Pattern: "15 m (49ft)" -> "49ft"
    text = re.sub(r'\d+(?:\.\d+)?\s*m\s*\((\d+(?:\.\d+)?)\s*ft\)', r'\1 ft', text)

    # Handle "X m (Yft Zin)" patterns - "1 m (3ft 3in)" -> "3ft 3in"
    text = re.sub(r'\d+(?:\.\d+)?\s*m\s*\(([^)]+(?:ft|in)[^)]*)\)', r'\1', text)

    # Convert temperatures: -4°c, 14°c, 40°C, etc.
    def convert_temp(match):
        temp_str = match.group(1).replace(',', '')
        temp_c = float(temp_str)
        temp_f = celsius_to_fahrenheit(temp_c)
        return f"{temp_f}°F"

    # Match temp with degree symbol
    text = re.sub(r'(-?\d+(?:,\d{3})*(?:\.\d+)?)\s*°\s*[cC](?:elsius)?(?![a-zA-Z])', convert_temp, text)

    # Convert meters: 15 m, 2.5m, 20 metres, 2,800 metres etc.
    def convert_m(match):
        meters_str = match.group(1).replace(',', '')
        meters = float(meters_str)
        feet = meters_to_feet(meters)
        return f"{feet} ft"

    text = re.sub(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*m(?:eters?|etres?)?(?=[\s,\.\)]|$)', convert_m, text)

    # Convert centimeters: 12cm, 45 cm, etc.
    def convert_cm(match):
        cm_str = match.group(1).replace(',', '')
        cm = float(cm_str)
        inches = cm_to_inches(cm)
        return f"{inches} in"

    text = re.sub(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*cm(?=[\s,\.\)]|$)', convert_cm, text)

    # Convert millimeters (rainfall): 500mm, 2000 mm, 2,000mm etc.
    def convert_mm(match):
        mm_str = match.group(1).replace(',', '')
        mm = float(mm_str)
        inches = mm_to_inches(mm)
        return f"{inches} in"

    text = re.sub(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*mm(?=[\s,\.\)]|$)', convert_mm, text)

    # Convert kilograms: 15 kg, etc.
    def convert_kg(match):
        kg_str = match.group(1).replace(',', '')
        kg = float(kg_str)
        lbs = kg_to_lbs(kg)
        return f"{lbs} lbs"

    text = re.sub(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*kg(?=[\s,\.\)]|$)', convert_kg, text)

    # Convert hectares to acres: 1 hectare = 2.47105 acres
    def convert_hectare(match):
        ha_str = match.group(1).replace(',', '')
        ha = float(ha_str)
        acres = round(ha * 2.47105, 1)
        return f"{acres} acres"

    text = re.sub(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*hectares?(?=[\s,\.\)]|$)', convert_hectare, text)

    # Convert tonnes to tons (metric ton ≈ US ton for practical purposes)
    text = re.sub(r'(\d+(?:,\d{3})*(?:\.\d+)?)\s*tonnes?(?=[\s,\.\)]|$)', r'\1 tons', text)

    return text


class PlantImportService:
    """Service for importing plant data from external sources"""

    def __init__(self):
        self.timeout = 30.0
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        self.pfaf_references_url = "https://pfaf.org/user/cmspage.aspx?pageid=174"
        # Disclaimers to remove from text
        self.disclaimers = [
            "Plants For A Future can not take any responsibility for any adverse effects from the use of plants. Always seek advice from a professional before using a plant medicinally.",
            "Plants For A Future cannot take any responsibility for any adverse effects from the use of plants. Always seek advice from a professional before using a plant medicinally.",
        ]

    async def import_from_url(self, url: str) -> Dict[str, Any]:
        """
        Import plant data from a URL.
        Automatically detects the source and uses appropriate parser.
        """
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        if "pfaf.org" in domain:
            return await self.import_from_pfaf(url)
        elif "permapeople.org" in domain:
            return await self.import_from_permapeople(url)
        else:
            raise ValueError(f"Unsupported source: {domain}. Supported: pfaf.org, permapeople.org")

    async def _fetch_pfaf_references(self, client: httpx.AsyncClient) -> Dict[str, str]:
        """Fetch and parse PFAF reference page, with caching"""
        global _pfaf_references_cache

        if _pfaf_references_cache:
            return _pfaf_references_cache

        try:
            response = await client.get(self.pfaf_references_url, headers=self.headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "lxml")

            # References are in format: [123] Author. Title. Publisher Year ISBN
            # Parse all <p> and <b>/<strong> tags for reference entries
            page_text = soup.get_text()

            # Match patterns like [301] or [301b]
            ref_pattern = re.compile(r'\[(\d+[a-z]?)\]\s*([^\[]+?)(?=\[\d|$)', re.DOTALL)
            matches = ref_pattern.findall(page_text)

            for ref_num, ref_text in matches:
                # Clean up the reference text
                ref_text = re.sub(r'\s+', ' ', ref_text).strip()
                if ref_text and len(ref_text) > 5:  # Skip empty or too short
                    _pfaf_references_cache[ref_num] = ref_text[:500]  # Limit length

            logger.debug(f"Loaded {len(_pfaf_references_cache)} PFAF references")

        except Exception as e:
            logger.warning(f"Failed to fetch PFAF references: {e}")

        return _pfaf_references_cache

    def _extract_reference_numbers(self, text: str) -> Set[str]:
        """Extract all reference numbers from text like [301], [105, 177], [301b]"""
        refs = set()
        # Match [123] or [123, 456] or [123b]
        matches = re.findall(r'\[(\d+[a-z]?(?:\s*,\s*\d+[a-z]?)*)\s*\]', text)
        for match in matches:
            # Split comma-separated refs
            for ref in match.split(','):
                ref = ref.strip()
                if ref:
                    refs.add(ref)
        return refs

    def _strip_references_from_text(self, text: str, preserve_newlines: bool = False) -> str:
        """Remove reference numbers from text"""
        # Remove [123], [123, 456], [123b], etc.
        text = re.sub(r'\[\d+[a-z]?(?:\s*,\s*\d+[a-z]?)*\s*\]', '', text)
        # Clean up extra whitespace (but preserve newlines if requested)
        if preserve_newlines:
            # Only collapse horizontal whitespace (spaces, tabs)
            text = re.sub(r'[^\S\n]+', ' ', text)
        else:
            text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _remove_disclaimers(self, text: str, preserve_newlines: bool = False) -> str:
        """Remove PFAF disclaimers from text"""
        for disclaimer in self.disclaimers:
            text = text.replace(disclaimer, '')
        # Clean up extra whitespace (but preserve newlines if requested)
        if preserve_newlines:
            text = re.sub(r'[^\S\n]+', ' ', text)
        else:
            text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _extract_care_icons(self, soup: BeautifulSoup) -> Dict[str, str]:
        """
        Extract care information from PFAF's Care field icons.
        The Care row contains icons for hardiness, moisture, and sun requirements.

        Icon mappings from https://pfaf.org/user/popup.aspx:
        - Hardiness: H1 (Tender), H2 (Half Hardy), H3 (Frost Hardy), H4 (Fully Hardy)
        - Moisture: water0 (Dry), water1 (Dry/Moist), water2 (Moist), water3 (Moist/Wet), water4 (Wet)
        - Sun: sun (Full sun), semishade (Part shade), shade (Full shade)
        """
        care_data = {}

        # Find the Care row - look for table with id "tblIcons"
        icons_table = soup.find("table", {"id": "ContentPlaceHolder1_tblIcons"})
        if not icons_table:
            # Fallback: find by traversing from Care text
            for row in soup.find_all("tr"):
                if "Care" in row.get_text() and "(info)" in row.get_text():
                    icons_table = row.find("table")
                    break

        if not icons_table:
            return care_data

        # Extract all images in the care icons table
        for img in icons_table.find_all("img"):
            alt = img.get("alt", "").lower()
            title = img.get("title", "").lower()
            src = img.get("src", "").lower()

            # Determine the icon type and value
            icon_text = alt or title

            # Moisture icons - most reliable from src filename
            if "water" in src:
                if "water0" in src or "dry soil" in icon_text:
                    care_data["moisture"] = "dry"
                elif "water1" in src:
                    care_data["moisture"] = "dry_moist"
                elif "water2" in src or "moist soil" in icon_text:
                    care_data["moisture"] = "moist"
                elif "water3" in src:
                    care_data["moisture"] = "moist_wet"
                elif "water4" in src or "wet soil" in icon_text:
                    care_data["moisture"] = "wet"
            # Sun icons
            elif "sun" in src or "shade" in src:
                if "semishade" in src or "semi-shade" in src or "part" in icon_text:
                    care_data["sun"] = "partial_shade"
                elif "shade" in src and "semi" not in src:
                    care_data["sun"] = "full_shade"
                elif "sun" in src or "full sun" in icon_text:
                    care_data["sun"] = "full_sun"
            # Hardiness icons (H1-H4)
            elif "h1" in src or "tender" in icon_text:
                care_data["hardiness"] = "tender"
                care_data["frost_sensitive"] = True
            elif "h2" in src or "half hardy" in icon_text:
                care_data["hardiness"] = "half_hardy"
                care_data["frost_sensitive"] = True
            elif "h3" in src or "frost hardy" in icon_text:
                care_data["hardiness"] = "frost_hardy"
                care_data["frost_sensitive"] = False
            elif "h4" in src or "fully hardy" in icon_text:
                care_data["hardiness"] = "fully_hardy"
                care_data["frost_sensitive"] = False

        logger.debug(f"Extracted care icons: {care_data}")
        return care_data

    async def import_from_pfaf(self, url: str) -> Dict[str, Any]:
        """
        Scrape plant data from Plants For A Future (pfaf.org)
        """
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()

            # Fetch references in parallel
            pfaf_refs = await self._fetch_pfaf_references(client)

        soup = BeautifulSoup(response.text, "lxml")
        data = {}
        all_reference_nums: Set[str] = set()

        # Extract care icons FIRST - most reliable source for moisture/sun/hardiness
        care_icons = self._extract_care_icons(soup)
        if care_icons.get("moisture"):
            data["moisture_preference"] = care_icons["moisture"]
        if care_icons.get("sun"):
            data["sun_requirement"] = care_icons["sun"]
        if "frost_sensitive" in care_icons:
            data["frost_sensitive"] = care_icons["frost_sensitive"]

        # Extract Latin name from URL parameter or title
        parsed_url = urlparse(url)
        query_params = parse_qs(parsed_url.query)
        if "LatinName" in query_params:
            data["latin_name"] = query_params["LatinName"][0].replace("+", " ")

        # Also try to get from title
        title = soup.find("title")
        if title:
            title_text = title.get_text()
            # Title format: "Quercus suber Cork Oak PFAF Plant Database"
            match = re.match(r"([A-Z][a-z]+ [a-z]+(?:\s+var\.\s+\w+)?)", title_text)
            if match:
                data["latin_name"] = match.group(1)

        # Try to find content by looking for specific text patterns
        page_text = soup.get_text()

        # Common name - look for it after "Common Name" text
        common_match = re.search(r"Common Name[:\s]+([^\n]+)", page_text)
        if common_match:
            name = common_match.group(1).strip()
            if name and name.lower() not in ["", "none", "n/a"]:
                data["name"] = name.split(",")[0].strip()  # Take first common name

        # Find spans with IDs containing label info (PFAF structure)
        # PFAF uses both "lbl" and "txt" prefixes inconsistently
        for span in soup.find_all("span"):
            span_id = span.get("id", "")

            # For uses sections, we need to preserve line breaks from <br> tags
            # Get HTML first, replace <br> with a unique marker, then extract text
            span_html = str(span)
            span_html_with_breaks = re.sub(r'<br\s*/?>', '|||LINEBREAK|||', span_html)
            span_soup = BeautifulSoup(span_html_with_breaks, "lxml")
            span_text = span_soup.get_text(separator=' ')
            # Convert markers back to newlines
            span_text = span_text.replace('|||LINEBREAK|||', '\n')
            span_text = span_text.strip()

            if not span_text or span_text in ["", "&nbsp;", "N"]:
                continue

            span_id_lower = span_id.lower()

            # Common name - PFAF uses "lblCommanName" (note typo) and "lbldisaliases"
            if "lblcommanname" in span_id_lower or "lblcommonname" in span_id_lower or "lbldisaliases" in span_id_lower:
                if not data.get("name"):
                    data["name"] = span_text.split(",")[0].strip()
            # Summary - this is the actual description we want!
            elif "txtsummary" in span_id_lower:
                data["summary"] = span_text
            # Habitats - both "txthabitats" and "lblhabitats" exist
            elif "habitat" in span_id_lower:
                data["habitat"] = span_text
            elif "lblrange" in span_id_lower:
                data["native_range"] = span_text
            elif "lblfamily" in span_id_lower:
                data["family"] = span_text
            elif "lblusdahardiness" in span_id_lower or "usdazone" in span_id_lower:
                data["grow_zones"] = span_text
            # Uses sections - PFAF uses "txt" prefix - keep full text, extract refs
            elif "txtedibleuses" in span_id_lower:
                all_reference_nums.update(self._extract_reference_numbers(span_text))
                data["edible_uses"] = self._clean_uses_text(span_text, strip_refs=True, category="edible")
            elif "txtmediuses" in span_id_lower:
                all_reference_nums.update(self._extract_reference_numbers(span_text))
                text = self._remove_disclaimers(span_text, preserve_newlines=True)
                data["medicinal_uses"] = self._clean_uses_text(text, strip_refs=True, category="medicinal")
            elif "txtotheruses" in span_id_lower:
                all_reference_nums.update(self._extract_reference_numbers(span_text))
                data["other_uses"] = self._clean_uses_text(span_text, strip_refs=True, category="other")
            # Cultivation and propagation
            elif "txtcultivationdetails" in span_id_lower:
                all_reference_nums.update(self._extract_reference_numbers(span_text))
                data["cultivation"] = self._clean_text(span_text, strip_refs=True)
            elif "txtpropagation" in span_id_lower:
                all_reference_nums.update(self._extract_reference_numbers(span_text))
                data["propagation"] = self._clean_text(span_text, strip_refs=True)
            # Physical characteristics statement
            elif "lblphystatment" in span_id_lower:
                data["physical_characteristics"] = self._clean_text(span_text)
            # Hazards
            elif "lblknownhazards" in span_id_lower:
                if span_text.lower() not in ["none known", "none", "n"]:
                    all_reference_nums.update(self._extract_reference_numbers(span_text))
                    data["known_hazards"] = self._clean_text(span_text, strip_refs=True)

        # Parse the description/meta tag for additional structured info
        meta_desc = soup.find("meta", {"name": "description"})
        if meta_desc and meta_desc.get("content"):
            desc_content = meta_desc["content"]
            data["full_description"] = desc_content

            # Extract size from description
            # Format: "growing to 3 m (9ft) by 1 m (3ft 3in)"
            size_match = re.search(
                r"growing to (\d+(?:\.\d+)?\s*m?\s*\([^)]+\))\s*by\s*(\d+(?:\.\d+)?\s*m?\s*\([^)]+\))",
                desc_content,
                re.I
            )
            if size_match:
                data["size_full_grown"] = f"{size_match.group(1)} tall x {size_match.group(2)} wide"

            # Extract growth rate
            rate_match = re.search(r"at a (slow|medium|fast|very fast) rate", desc_content, re.I)
            if rate_match:
                rate = rate_match.group(1).lower()
                rate_map = {"slow": "slow", "medium": "moderate", "fast": "fast", "very fast": "very_fast"}
                data["growth_rate"] = rate_map.get(rate, "moderate")

            # Extract frost sensitivity (only if not already set from care icons)
            if "frost_sensitive" not in data:
                if "frost tender" in desc_content.lower():
                    data["frost_sensitive"] = True
                elif "frost hardy" in desc_content.lower() or "very hardy" in desc_content.lower():
                    data["frost_sensitive"] = False

            # Extract sun requirement (only if not already set from care icons)
            if "sun_requirement" not in data:
                if "cannot grow in the shade" in desc_content.lower():
                    data["sun_requirement"] = "full_sun"
                elif "semi-shade" in desc_content.lower():
                    data["sun_requirement"] = "partial_shade"
                elif "full shade" in desc_content.lower():
                    data["sun_requirement"] = "full_shade"
                else:
                    # Default to partial shade if it mentions shade tolerance
                    data["sun_requirement"] = "partial_sun"

            # Extract soil info - look for "Suitable for:" pattern
            soil_match = re.search(r"Suitable for[:\s]+([^.]+(?:soils|soil))", desc_content, re.I)
            if soil_match:
                data["soil_requirements"] = self._clean_text(soil_match.group(1))

            # Extract pH preference
            ph_match = re.search(r"Suitable pH[:\s]+([^.]+)", desc_content, re.I)
            if ph_match:
                data["soil_ph"] = self._clean_text(ph_match.group(1))

            # Extract moisture preference from description (only if not already set from care icons)
            # Look for patterns like "Prefers dry soil", "dry or moist soil", etc.
            if "moisture_preference" not in data:
                moisture_pref = self._extract_moisture_preference(desc_content)
                if moisture_pref:
                    data["moisture_preference"] = moisture_pref

        # Also check cultivation text for moisture hints (only if not already set)
        cultivation = data.get("cultivation", "")
        if cultivation and "moisture_preference" not in data:
            moisture_pref = self._extract_moisture_preference(cultivation)
            if moisture_pref:
                data["moisture_preference"] = moisture_pref

        # Extract temperature tolerance from cultivation notes
        cultivation = data.get("cultivation", "")
        if cultivation:
            # Look for temperature patterns like "-6°c" or "0°c" or "-15 to -20c"
            temp_matches = re.findall(r"(-?\d+)\s*(?:°|degrees?)?\s*[cC]", cultivation)
            if temp_matches:
                temps = [int(t) for t in temp_matches]
                if temps:
                    min_temp_c = min(temps)
                    # Convert to Fahrenheit
                    data["min_temp"] = round(min_temp_c * 9/5 + 32, 1)

        # Build uses from individual use categories - NO truncation
        # Each category already has its proper header (e.g., "Edible Parts: X\n\nEdible Uses:\n\n...")
        uses_parts = []
        if "edible_uses" in data and data["edible_uses"]:
            uses_parts.append(data['edible_uses'])
        if "medicinal_uses" in data and data["medicinal_uses"]:
            uses_parts.append(data['medicinal_uses'])
        if "other_uses" in data and data["other_uses"]:
            uses_parts.append(data['other_uses'])
        if uses_parts:
            data["uses"] = "\n\n".join(uses_parts)

        # Extract propagation methods from propagation text
        if "propagation" in data:
            prop_text = data["propagation"].lower()
            methods = []
            if "seed" in prop_text:
                methods.append("seed")
            if "cutting" in prop_text:
                methods.append("cuttings")
            if "layer" in prop_text:
                methods.append("layering")
            if "graft" in prop_text:
                methods.append("grafting")
            if "division" in prop_text:
                methods.append("division")
            if methods:
                data["propagation_methods"] = ", ".join(methods)

        # Use summary from txtSummary span as description (preferred)
        # Fall back to meta description, then physical characteristics
        if "summary" in data:
            data["description"] = data["summary"]
        elif "full_description" in data:
            data["description"] = data["full_description"]
        elif "physical_characteristics" in data:
            data["description"] = data["physical_characteristics"]

        # Build references field from extracted reference numbers
        references = [f"Source: {url}"]
        for ref_num in sorted(all_reference_nums, key=lambda x: (int(re.match(r'\d+', x).group()), x)):
            if ref_num in pfaf_refs:
                references.append(f"[{ref_num}] {pfaf_refs[ref_num]}")
            else:
                references.append(f"[{ref_num}] PFAF Reference #{ref_num}")

        data["references"] = "\n\n".join(references)

        # Clean up and map to Plant model fields
        return self._map_to_plant_model(data, url)

    async def import_from_permapeople(self, url: str) -> Dict[str, Any]:
        """
        Scrape plant data from Permapeople.org
        """
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")
        data = {}

        # Extract plant name from h1
        h1 = soup.find("h1")
        if h1:
            full_name = h1.get_text(strip=True)
            # Format: "Solanum lycopersicum - Tomato"
            if " - " in full_name:
                parts = full_name.split(" - ", 1)
                data["latin_name"] = parts[0].strip()
                data["name"] = parts[1].strip()
            else:
                data["name"] = full_name

        # Find data fields - Permapeople uses structured field-value pairs
        # Look for dt/dd pairs or specific class patterns
        for row in soup.find_all(["tr", "div"], class_=re.compile(r"field|data|info", re.I)):
            label_elem = row.find(["th", "dt", "label", "strong"])
            value_elem = row.find(["td", "dd", "span"])
            if label_elem and value_elem:
                label = label_elem.get_text(strip=True).lower().rstrip(":")
                value = value_elem.get_text(strip=True)
                self._parse_permapeople_field(data, label, value)

        # Also look for specific text patterns in the page
        page_text = soup.get_text()

        # USDA zones
        zone_match = re.search(r"USDA[^:]*:?\s*(\d+)\s*[-–]\s*(\d+)", page_text, re.I)
        if zone_match:
            data["grow_zones"] = f"{zone_match.group(1)}-{zone_match.group(2)}"

        # Light requirements
        light_match = re.search(r"Light[^:]*:?\s*([^,\n]+)", page_text, re.I)
        if light_match and "sun_requirement" not in data:
            light = light_match.group(1).lower()
            if "full sun" in light:
                data["sun_requirement"] = "full_sun"
            elif "partial" in light or "part" in light:
                data["sun_requirement"] = "partial_sun"
            elif "shade" in light:
                data["sun_requirement"] = "partial_shade"

        # Height/Width
        height_match = re.search(r"Height[^:]*:?\s*([\d.]+)\s*m?", page_text, re.I)
        width_match = re.search(r"Width[^:]*:?\s*([\d.]+)\s*m?", page_text, re.I)
        if height_match or width_match:
            h = height_match.group(1) if height_match else "?"
            w = width_match.group(1) if width_match else "?"
            data["size_full_grown"] = f"{h}m tall x {w}m wide"

        # Growth rate
        rate_match = re.search(r"Growth[^:]*:?\s*(Slow|Medium|Fast|Very Fast)", page_text, re.I)
        if rate_match:
            rate = rate_match.group(1).lower()
            rate_map = {"slow": "slow", "medium": "moderate", "fast": "fast", "very fast": "very_fast"}
            data["growth_rate"] = rate_map.get(rate, "moderate")

        # Add source reference
        data["references"] = f"Source: {url}"

        return self._map_to_plant_model(data, url)

    def _parse_permapeople_field(self, data: Dict, label: str, value: str):
        """Parse a single field from Permapeople"""
        if not value or value.lower() in ["", "n/a", "none", "unknown"]:
            return

        if "usda" in label or "hardiness" in label:
            data["grow_zones"] = value
        elif "light" in label or "sun" in label:
            lower = value.lower()
            if "full sun" in lower:
                data["sun_requirement"] = "full_sun"
            elif "partial" in lower:
                data["sun_requirement"] = "partial_sun"
            elif "shade" in lower:
                data["sun_requirement"] = "partial_shade"
        elif "water" in label:
            data["water_requirement"] = value
        elif "soil" in label and "ph" not in label:
            data["soil_requirements"] = value
        elif "ph" in label:
            data["soil_ph"] = value
        elif "height" in label:
            data["height"] = value
        elif "width" in label or "spread" in label:
            data["width"] = value
        elif "growth" in label and "rate" in label:
            rate = value.lower()
            rate_map = {"slow": "slow", "medium": "moderate", "fast": "fast", "very fast": "very_fast"}
            data["growth_rate"] = rate_map.get(rate, "moderate")
        elif "edible" in label and "part" in label:
            data["edible_parts"] = value
        elif "family" in label:
            data["family"] = value
        elif "native" in label:
            data["native_range"] = value
        elif "propagat" in label:
            data["propagation"] = value

    def _extract_moisture_preference(self, text: str) -> Optional[str]:
        """
        Extract moisture preference from text.
        Returns: dry, dry_moist, moist, moist_wet, wet, or None

        Priority order:
        1. "prefers X" statements (explicit preference)
        2. Range statements like "dry or moist", "moist to wet"
        3. "tolerates X" statements (secondary tolerance, not preference)
        4. PFAF moisture codes (D, DM, M, MWe, We)
        """
        if not text:
            return None

        text_lower = text.lower()

        # ===== PRIORITY 1: Explicit "prefers X" statements =====
        # These are the strongest indicators of actual preference

        # Wet/bog plants - explicit preference
        if any(p in text_lower for p in ["bog", "aquatic", "water plant", "waterlogged"]):
            return "wet"

        # "prefers wet soil"
        if re.search(r"prefers?\s+wet\s+soil", text_lower):
            return "wet"

        # "prefers moist soil" - check this BEFORE drought tolerance
        if re.search(r"prefers?\s+moist\s+soil", text_lower):
            return "moist"

        # "prefers dry soil"
        if re.search(r"prefers?\s+dry\s+soil", text_lower):
            return "dry"

        # ===== PRIORITY 2: Range statements =====
        # These indicate adaptability across moisture levels

        # Moist to wet range
        if any(p in text_lower for p in ["moist or wet", "moist to wet", "wet or moist"]):
            return "moist_wet"

        # Dry or moist range (adaptable)
        if re.search(r"dry\s+or\s+moist|dry\s+to\s+moist|moist\s+or\s+dry", text_lower):
            return "dry_moist"

        # ===== PRIORITY 3: Secondary moisture indicators =====
        # Less explicit but still useful

        # "moist but well-drained" - common phrase for average moisture
        if re.search(r"moist\s+but\s+well[- ]drained", text_lower):
            return "moist"

        # "wet soil" without other context
        if "wet soil" in text_lower:
            return "moist_wet"

        # "moist soil" without dry context
        if "moist soil" in text_lower and "dry" not in text_lower:
            return "moist"

        # ===== PRIORITY 4: Tolerance statements =====
        # Only use these if no preference was found
        # "tolerates drought" doesn't mean it prefers dry - it can survive it

        # "drought tolerant" as primary characteristic (no moisture preference stated)
        if "drought tolerant" in text_lower and "moist" not in text_lower:
            return "dry"

        # ===== PRIORITY 5: PFAF moisture codes =====
        # These appear in tables with format like "Moisture: D"
        code_match = re.search(r"moisture[:\s]+([DMWea]+)", text_lower, re.I)
        if code_match:
            code = code_match.group(1).upper()
            if code == "D":
                return "dry"
            elif code == "DM":
                return "dry_moist"
            elif code == "M":
                return "moist"
            elif code in ["MWE", "MWe"]:
                return "moist_wet"
            elif code in ["WE", "We", "WA", "Wa"]:
                return "wet"

        return None

    def _clean_text(self, text: str, strip_refs: bool = False) -> str:
        """Clean up text by removing extra whitespace and HTML entities"""
        if not text:
            return ""
        # Remove HTML entities
        text = re.sub(r"&nbsp;", " ", text)
        text = re.sub(r"&amp;", "&", text)
        # Optionally remove reference numbers like [1], [2, 3], [301b]
        if strip_refs:
            text = self._strip_references_from_text(text)
        # Collapse whitespace
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _clean_uses_text(self, text: str, strip_refs: bool = False, category: str = "") -> str:
        """Clean up uses text, preserving meaningful line breaks for structure.

        PFAF HTML structure:
        - "Edible Parts: <links><br>Edible Uses:<br><br>Description text..."
        - "Medicinal Uses: <links><br><br>Description text..."
        - "Other Uses: <links><br><br>Description text..."

        We want output like:
        - "Edible Parts: Fruit\n\nEdible Uses:\n\nThe fruit is excellent..."
        """
        if not text:
            return ""
        # Remove HTML entities
        text = re.sub(r"&nbsp;", " ", text)
        text = re.sub(r"&amp;", "&", text)
        # Optionally remove reference numbers like [1], [2, 3], [301b]
        # Preserve newlines since we need them for structure
        if strip_refs:
            text = self._strip_references_from_text(text, preserve_newlines=True)

        # Normalize horizontal whitespace only (not newlines)
        text = re.sub(r'[^\S\n]+', ' ', text)

        # For edible uses, format the parts and uses headers properly
        if category == "edible":
            # Pattern: "Edible Parts: X Edible Uses: Description"
            # We want: "Edible Parts: X\n\nEdible Uses:\n\nDescription"
            text = re.sub(
                r'Edible Parts\s*:\s*([^\n]+?)\s*Edible Uses\s*:\s*',
                r'Edible Parts: \1\n\nEdible Uses:\n\n',
                text, flags=re.IGNORECASE
            )
        elif category == "medicinal":
            # PFAF HTML: "Febrifuge&nbsp;&nbsp;Skin<br><br>A decoction..."
            # After processing: "Febrifuge  Skin\n\nA decoction..."
            # We want: "Medicinal Uses: Febrifuge | Skin\n\nA decoction..."
            # Tags are on the first line, separated by spaces, before the double newline
            parts = re.split(r'\n\s*\n', text, maxsplit=1)
            if len(parts) == 2:
                tag_line = parts[0].strip()
                description = parts[1].strip()
                # Tags are capitalized words separated by whitespace
                tag_words = re.findall(r'[A-Z][a-z]+', tag_line)
                if tag_words:
                    text = f"Medicinal Uses: {' | '.join(tag_words)}\n\n{description}"
        elif category == "other":
            # PFAF HTML: "Latex&nbsp;&nbsp;Wood<br><br>Other Uses: The tree..."
            # After processing: "Latex  Wood\n\nOther Uses: The tree..."
            # We want: "Other Uses: Latex | Wood\n\nThe tree..."
            parts = re.split(r'\n\s*\n', text, maxsplit=1)
            if len(parts) == 2:
                tag_line = parts[0].strip()
                description = parts[1].strip()
                # Remove "Other Uses:" prefix from description
                description = re.sub(r'^Other\s+Uses\s*:\s*', '', description, flags=re.IGNORECASE)
                # Tags are capitalized words separated by whitespace
                tag_words = re.findall(r'[A-Z][a-z]+', tag_line)
                if tag_words:
                    text = f"Other Uses: {' | '.join(tag_words)}\n\n{description}"

        # Collapse excessive newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r' *\n *', '\n', text)
        return text.strip()

    def _map_to_plant_model(self, data: Dict[str, Any], source_url: str = None) -> Dict[str, Any]:
        """
        Map scraped data to Plant model fields.
        Returns only fields that have values.
        Converts metric measurements to imperial.
        """
        result = {}

        # Direct mappings (no conversion needed)
        direct_fields = [
            "name", "latin_name", "variety", "grow_zones", "growth_rate",
            "frost_sensitive", "propagation_methods", "references"
        ]

        for field in direct_fields:
            if field in data and data[field]:
                result[field] = data[field]

        # Text fields that may contain metric measurements - convert to imperial
        text_fields_to_convert = [
            "description", "soil_requirements", "size_full_grown",
            "uses", "known_hazards"
        ]

        for field in text_fields_to_convert:
            if field in data and data[field]:
                result[field] = convert_metric_measurements(data[field])

        # Sun requirement (ensure valid enum value)
        if "sun_requirement" in data:
            valid_sun = ["full_sun", "partial_sun", "partial_shade", "full_shade"]
            if data["sun_requirement"] in valid_sun:
                result["sun_requirement"] = data["sun_requirement"]

        # Moisture preference (ensure valid enum value)
        if "moisture_preference" in data:
            valid_moisture = ["dry", "dry_moist", "moist", "moist_wet", "wet"]
            if data["moisture_preference"] in valid_moisture:
                result["moisture_preference"] = data["moisture_preference"]

        # Temperature (min_temp)
        if "min_temp" in data:
            try:
                result["min_temp"] = float(data["min_temp"])
            except (ValueError, TypeError):
                pass

        # Combine soil pH into soil_requirements if present
        if "soil_ph" in data and data["soil_ph"]:
            existing = result.get("soil_requirements", "")
            if existing:
                result["soil_requirements"] = f"{existing}; pH: {data['soil_ph']}"
            else:
                result["soil_requirements"] = f"pH: {data['soil_ph']}"

        # Default frost_sensitive to True if not set but min_temp indicates frost tender
        if "min_temp" in result and result["min_temp"] > 28:  # Above 28°F = frost tender
            if "frost_sensitive" not in result:
                result["frost_sensitive"] = True

        # Map cultivation -> cultivation_details (with metric conversion)
        if "cultivation" in data and data["cultivation"]:
            result["cultivation_details"] = convert_metric_measurements(data["cultivation"])

        logger.debug(f"Mapped plant data: {result}")
        return result


# Singleton instance
plant_import_service = PlantImportService()
