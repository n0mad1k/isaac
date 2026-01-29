"""
Plant Data Import Service
Fetches and parses plant data from external sources (PFAF, Gardenia.net, Growables.org)
"""

import re
import json
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

    def _is_allowed_domain(self, domain: str, allowed: str) -> bool:
        """
        Safely check if domain matches allowed domain.

        SECURITY: Uses exact match or subdomain match to prevent SSRF bypasses
        like "pfaf.org.attacker.com" which would pass a simple "in" check.
        """
        return domain == allowed or domain.endswith("." + allowed)

    def _validate_response_url(self, response, allowed_domain: str) -> None:
        """
        Validate that the response URL (after redirects) is still on an allowed domain.

        SECURITY: Prevents SSRF redirect bypass where attacker sets up:
        pfaf.org/redirect -> attacker.com/malicious
        The initial URL passes validation, but httpx follows the redirect.
        """
        final_url = str(response.url)
        final_domain = urlparse(final_url).netloc.lower()
        if not self._is_allowed_domain(final_domain, allowed_domain):
            raise ValueError(f"Redirect to disallowed domain: {final_domain}")

    async def import_from_url(self, url: str) -> Dict[str, Any]:
        """
        Import plant data from a URL.
        Automatically detects the source and uses appropriate parser.

        SECURITY: Domain whitelist is strictly enforced to prevent SSRF attacks.
        """
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        if self._is_allowed_domain(domain, "pfaf.org"):
            return await self.import_from_pfaf(url)
        elif self._is_allowed_domain(domain, "gardenia.net"):
            return await self.import_from_gardenia(url)
        elif self._is_allowed_domain(domain, "growables.org"):
            return await self.import_from_growables(url)
        elif self._is_allowed_domain(domain, "picturethisai.com"):
            return await self.import_from_picturethis(url)
        else:
            raise ValueError(f"Unsupported source: {domain}. Supported: pfaf.org, gardenia.net, growables.org, picturethisai.com")

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
            self._validate_response_url(response, "pfaf.org")

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
            # Look for temperature patterns like "-6°C" or "0°c" or "-15 degrees c"
            # Must have ° or "degrees" before C to avoid matching things like "78.74 in"
            temp_matches = re.findall(r"(-?\d+)\s*(?:°|degrees)\s*[cC]", cultivation)
            if temp_matches:
                temps = [int(t) for t in temp_matches]
                # Filter out unreasonable temps (below -60°C or above 50°C is unlikely)
                temps = [t for t in temps if -60 <= t <= 50]
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

    async def import_from_gardenia(self, url: str) -> Dict[str, Any]:
        """
        Scrape plant data from Gardenia.net using JSON-LD structured data
        """
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            self._validate_response_url(response, "gardenia.net")

        soup = BeautifulSoup(response.text, "lxml")
        data = {}

        # Find JSON-LD structured data
        json_ld = None
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                json_data = json.loads(script.string)
                if isinstance(json_data, dict) and "@graph" in json_data:
                    json_ld = json_data["@graph"]
                    break
            except (json.JSONDecodeError, TypeError):
                continue

        if not json_ld:
            raise ValueError("Could not find plant data on this Gardenia.net page")

        # Extract data from JSON-LD graph
        taxon = None
        dataset = None
        article = None

        for item in json_ld:
            item_type = item.get("@type", "")
            if item_type == "Taxon":
                taxon = item
            elif item_type == "Dataset":
                dataset = item
            elif item_type == "Article":
                article = item

        if taxon:
            # Extract name from taxon
            name = taxon.get("name", "")
            if "(" in name and ")" in name:
                # Format: "Quercus suber (Cork Oak)"
                match = re.match(r"([^(]+)\(([^)]+)\)", name)
                if match:
                    data["latin_name"] = match.group(1).strip()
                    data["name"] = match.group(2).strip()
            else:
                data["name"] = name

            # Get alternate names (common names)
            alt_names = taxon.get("alternateName", [])
            if alt_names and not data.get("name"):
                data["name"] = alt_names[0] if isinstance(alt_names, list) else alt_names

            # Get description
            if taxon.get("description"):
                data["description"] = taxon["description"].strip()

            # Get family from parentTaxon
            parent_taxa = taxon.get("parentTaxon", [])
            for pt in parent_taxa:
                if pt.get("taxonRank") == "family":
                    data["family"] = pt.get("name")

        if dataset and "variableMeasured" in dataset:
            # Parse PropertyValue fields
            for prop in dataset["variableMeasured"]:
                prop_name = prop.get("name", "").lower()
                prop_value = prop.get("value")

                if prop_value is None:
                    continue

                # Handle QuantitativeValue (height, spread)
                if isinstance(prop_value, dict) and "@type" in prop_value:
                    if prop_value["@type"] == "QuantitativeValue":
                        min_val = prop_value.get("minValue")
                        max_val = prop_value.get("maxValue")
                        unit = prop_value.get("unitCode", "")
                        if min_val and max_val:
                            # Convert meters to feet
                            if unit == "M":
                                min_ft = round(min_val * 3.28084, 1)
                                max_ft = round(max_val * 3.28084, 1)
                                if "height" in prop_name:
                                    data["height"] = f"{min_ft}-{max_ft} ft"
                                elif "spread" in prop_name:
                                    data["width"] = f"{min_ft}-{max_ft} ft"
                    continue

                # Handle list values
                if isinstance(prop_value, list):
                    prop_value = ", ".join(str(v) for v in prop_value)

                # Map property names to data fields
                if "hardiness zones" in prop_name:
                    # USDA zones
                    zones = [str(v) for v in prop.get("value", [])]
                    if zones:
                        data["grow_zones"] = f"{min(zones)}-{max(zones)}"
                elif "sun requirement" in prop_name:
                    sun_map = {
                        "full sun": "full_sun",
                        "partial shade": "partial_shade",
                        "full shade": "full_shade",
                        "partial sun": "partial_sun",
                    }
                    sun_val = prop_value.lower() if isinstance(prop_value, str) else ""
                    for key, val in sun_map.items():
                        if key in sun_val:
                            data["sun_requirement"] = val
                            break
                elif "soil ph" in prop_name:
                    data["soil_ph"] = prop_value
                elif "soil type" in prop_name:
                    data["soil_type"] = prop_value
                elif "soil drainage" in prop_name:
                    data["soil_drainage"] = prop_value
                elif "water need" in prop_name:
                    water_val = prop_value.lower() if isinstance(prop_value, str) else ""
                    if "low" in water_val:
                        data["moisture_preference"] = "dry"
                    elif "average" in water_val:
                        data["moisture_preference"] = "moist"
                    elif "high" in water_val:
                        data["moisture_preference"] = "wet"
                elif "tolerance" in prop_name:
                    tol_val = prop_value.lower() if isinstance(prop_value, str) else ""
                    if "drought" in tol_val:
                        data["drought_tolerant"] = True
                elif "plant family" in prop_name and not data.get("family"):
                    data["family"] = prop_value
                elif "plant characteristics" in prop_name:
                    char_val = prop_value.lower() if isinstance(prop_value, str) else ""
                    if "evergreen" in char_val:
                        data["evergreen"] = True

        # Build size from height and width
        if data.get("height") or data.get("width"):
            h = data.pop("height", "?")
            w = data.pop("width", "?")
            data["size_full_grown"] = f"{h} tall x {w} wide"

        # Combine soil info
        soil_parts = []
        if data.get("soil_type"):
            soil_parts.append(f"Type: {data.pop('soil_type')}")
        if data.get("soil_drainage"):
            soil_parts.append(f"Drainage: {data.pop('soil_drainage')}")
        if data.get("soil_ph"):
            soil_parts.append(f"pH: {data.pop('soil_ph')}")
        if soil_parts:
            data["soil_requirements"] = "; ".join(soil_parts)

        # Add source reference
        data["references"] = f"Source: {url}"

        logger.debug(f"Gardenia.net parsed data: {data}")
        return self._map_to_plant_model(data, url)

    async def import_from_growables(self, url: str) -> Dict[str, Any]:
        """
        Scrape plant data from Growables.org
        Uses HTML with bold-styled spans as field labels, values follow as sibling text.
        """
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            self._validate_response_url(response, "growables.org")

        soup = BeautifulSoup(response.text, "lxml")
        data = {}

        # Extract title for name and latin name
        title = soup.find("title")
        if title:
            title_text = title.get_text(strip=True)
            # Format: "Pitaya, Dragon Fruit - Hylocereus undatus"
            if "," in title_text:
                parts = title_text.split(",", 1)
                data["name"] = parts[0].strip()
            elif " - " in title_text:
                parts = title_text.split(" - ", 1)
                data["name"] = parts[0].strip()

        # Extract from the main title row (th.tableborderbbgb)
        title_row = soup.find("th", class_="tableborderbbgb")
        if title_row:
            title_text = title_row.get_text(strip=True)
            if " - " in title_text:
                parts = title_text.split(" - ", 1)
                if not data.get("name"):
                    data["name"] = parts[0].strip()
            # Extract latin name from italicized text in title
            em = title_row.find(["em", "i"])
            if em:
                data["latin_name"] = em.get_text(strip=True)

        # Find all bold text labels and collect ALL text until the next bold label.
        # Growables uses <span style="font-weight: bold;">Label</span><br>Value text...
        # Values can span multiple lines/nodes between bold labels.
        for bold in soup.find_all(["b", "strong", "span"]):
            style = bold.get("style", "")
            if "font-weight" not in style and bold.name not in ["b", "strong"]:
                continue

            label = bold.get_text(strip=True).lower().rstrip(":").rstrip("*")
            if not label or len(label) > 80:
                continue

            # Collect all text between this bold label and the next bold/section break
            value_parts = []
            sibling = bold.next_sibling
            while sibling:
                # Stop at the next bold label
                if hasattr(sibling, 'name'):
                    if sibling.name in ['b', 'strong']:
                        break
                    if sibling.name == 'span' and 'font-weight' in sibling.get('style', ''):
                        break
                    if sibling.name == 'hr':
                        break  # Section divider
                    # Skip <br> tags, images, and sup (footnotes)
                    if sibling.name in ['br', 'img', 'sup']:
                        sibling = sibling.next_sibling
                        continue
                    # Get text from other elements (a, em, span, etc.)
                    text = sibling.get_text(strip=True)
                    if text:
                        value_parts.append(text)
                elif isinstance(sibling, str):
                    text = sibling.strip()
                    if text:
                        value_parts.append(text)
                sibling = sibling.next_sibling

            value = " ".join(value_parts).strip()

            # Skip empty or excessively long values
            if not value or len(value) > 2000:
                continue

            # Parse the field based on label
            self._parse_growables_field(data, label, value)

        # Add source reference
        data["references"] = f"Source: {url}"

        logger.debug(f"Growables.org parsed data: {data}")
        return self._map_to_plant_model(data, url)

    def _parse_growables_field(self, data: Dict, label: str, value: str):
        """Parse a single field from Growables.org"""
        if not value or value.lower() in ["", "n/a", "none", "unknown"]:
            return

        # Clean up the value
        value = re.sub(r'\s+', ' ', value).strip()
        # Strip leading asterisks (bold tag artifacts)
        value = value.lstrip("*").strip()
        # Remove figure references: "Fig. 7. Caption text" first (with captions),
        # then bare "Fig. 7Fig. 8" references (no captions)
        value = re.sub(r'Fig\.\s*\d+\.\s*[^.;]*(?:[.;]|$)', ' ', value)
        value = re.sub(r'Fig\.\s*\d+', '', value)
        # Clean up orphaned periods from stripped figure refs
        value = re.sub(r'(?<!\w)\.\s*(?=[A-Z]|\s|$)', ' ', value)
        value = re.sub(r'\s+', ' ', value).strip()

        # Skip garbage values (single punctuation, colons, etc.)
        if len(value) <= 2 and not value.isalnum():
            return

        # --- Identity ---
        if "scientific name" in label or label == "scientific":
            match = re.match(r"([A-Z][a-z]+ [a-z]+)", value)
            if match:
                data["latin_name"] = match.group(1)
        elif "common name" in label:
            names = value.split(",")
            if names and not data.get("name"):
                data["name"] = names[0].strip()
        elif label == "family":
            match = re.match(r"(\w+)", value)
            if match:
                data["family"] = match.group(1)

        # --- Hardiness & Zones ---
        elif "usda hardiness" in label or "hardiness zone" in label:
            zone_match = re.search(r"(\d+[ab]?)\s*[-–]\s*(\d+[ab]?)", value)
            if zone_match:
                data["grow_zones"] = f"{zone_match.group(1)}-{zone_match.group(2)}"
            else:
                data["grow_zones"] = value

        # --- Size ---
        elif label == "height" or label.startswith("height"):
            data["height"] = convert_metric_measurements(value)
        elif "spread" in label or "width" in label:
            data["width"] = convert_metric_measurements(value)

        # --- Light ---
        elif "light requirement" in label or "insolation" in label or label == "sun":
            lower = value.lower()
            if "full sun" in lower and "shade" not in lower:
                data["sun_requirement"] = "full_sun"
            elif "partial" in lower or "semi" in lower or ("sun" in lower and "shade" in lower):
                data["sun_requirement"] = "partial_sun"
            elif "full shade" in lower:
                data["sun_requirement"] = "full_shade"
            elif "shade" in lower:
                data["sun_requirement"] = "partial_shade"
            else:
                data["sun_requirement"] = "full_sun"

        # --- Soil ---
        elif "soil tolerance" in label or "soil type" in label:
            data["soil_requirements"] = value
        elif "ph" in label and "pest" not in label:
            data["soil_ph"] = value
        elif "soil salt" in label or "salt tolerance" in label:
            lower = value.lower()
            if "poor" not in lower and "none" not in lower:
                data["salt_tolerant"] = True

        # --- Water & Moisture ---
        elif "drought tolerance" in label or "drought" in label:
            lower = value.lower()
            data["drought_tolerance_notes"] = value
            if "poor" in lower or "low" in lower or "no " in lower or "cannot" in lower or "not " in lower:
                data["drought_tolerant"] = False
            else:
                data["drought_tolerant"] = True
        elif "irrigation" in label or "watering" in label or "water requirement" in label:
            data["water_notes"] = value
            # Extract moisture preference from irrigation text
            lower = value.lower()
            if "high water" in lower or "frequent" in lower or "regular" in lower:
                if not data.get("moisture_preference"):
                    data["moisture_preference"] = "moist"
            elif "low water" in lower or "minimal" in lower:
                if not data.get("moisture_preference"):
                    data["moisture_preference"] = "dry_moist"

        # --- Temperature ---
        elif "cold tolerance" in label or "cold hardiness" in label:
            temp_match = re.search(r"(-?\d+)\s*°?\s*[fF]", value)
            if temp_match:
                data["min_temp"] = float(temp_match.group(1))
            if "frost" in value.lower() or "freeze" in value.lower():
                data["frost_sensitive"] = True

        # --- Growth ---
        elif "growth rate" in label:
            lower = value.lower()
            if "rapid" in lower or "fast" in lower or "vigorous" in lower:
                data["growth_rate"] = "fast"
            elif "slow" in lower:
                data["growth_rate"] = "slow"
            else:
                data["growth_rate"] = "moderate"
        elif label == "plant habit" or label == "habit":
            data["plant_habit"] = value

        # --- Spacing ---
        elif "plant spacing" in label or "spacing" in label:
            data["plant_spacing"] = convert_metric_measurements(value)

        # --- Description ---
        elif label == "description":
            data["description"] = value[:1000]

        # --- Uses ---
        elif label == "uses" or label == "use":
            data["other_uses"] = value
        elif "edible" in label or "food" in label or "culinary" in label:
            data["edible_uses"] = value
        elif "medicinal" in label:
            data["medicinal_uses"] = value

        # --- Cultivation ---
        elif "pruning" in label:
            existing = data.get("cultivation", "")
            data["cultivation"] = f"{existing} Pruning: {value}".strip()
        elif "planting" in label and "spacing" not in label:
            existing = data.get("cultivation", "")
            data["cultivation"] = f"{existing} Planting: {value}".strip()

        # --- Propagation ---
        elif "propagation" in label:
            data["propagation_methods"] = value

        # --- Harvest ---
        elif "harvesting" in label or "harvest" in label:
            data["how_to_harvest"] = value
        elif label == "season" or "fruiting season" in label:
            data["produces_months"] = value

        # --- Hazards & Pests ---
        elif "known hazard" in label or "hazard" in label:
            data["known_hazards"] = value
        elif "pest" in label or "disease" in label:
            existing = data.get("pest_disease_notes", "")
            data["pest_disease_notes"] = f"{existing} {value}".strip()
        elif "invasive" in label:
            data["invasive_notes"] = value

        # --- Other ---
        elif "origin" in label:
            data["native_range"] = value
        elif "wind tolerance" in label:
            data["wind_tolerance"] = value
        elif "pollination" in label:
            existing = data.get("cultivation", "")
            data["cultivation"] = f"{existing} Pollination: {value}".strip()
        elif label == "longevity":
            existing = data.get("description", "")
            data["description"] = f"{existing} Longevity: {value}".strip()
        elif label == "flowers" or label == "fruit":
            # These are descriptive sections - append to description
            existing = data.get("description", "")
            section = label.capitalize()
            data["description"] = f"{existing} {section}: {value}".strip()
        elif "root" in label:
            existing = data.get("cultivation", "")
            data["cultivation"] = f"{existing} Roots: {value}".strip()

    def _unescape_js_string(self, html: str, var_name: str) -> Optional[str]:
        """
        Extract and unescape a JavaScript string variable from HTML.
        Handles: window.detail = "..." or window.careDetails = "..."
        Properly unescapes \\", \\\\, \\n, \\t, \\uXXXX, etc.
        """
        pattern = var_name.replace('.', r'\.') + r'\s*=\s*"'
        start_match = re.search(pattern, html)
        if not start_match:
            return None
        pos = start_match.end()
        result = []
        while pos < len(html):
            c = html[pos]
            if c == '\\':
                pos += 1
                if pos >= len(html):
                    break
                next_c = html[pos]
                if next_c == '"':
                    result.append('"')
                elif next_c == '\\':
                    result.append('\\')
                elif next_c == '/':
                    result.append('/')
                elif next_c == "'":
                    result.append("'")
                elif next_c == 'n':
                    result.append('\n')
                elif next_c == 't':
                    result.append('\t')
                elif next_c == 'r':
                    result.append('\r')
                elif next_c == 'b':
                    result.append('\b')
                elif next_c == 'f':
                    result.append('\f')
                elif next_c == 'u':
                    hex_str = html[pos+1:pos+5]
                    if len(hex_str) == 4:
                        try:
                            result.append(chr(int(hex_str, 16)))
                            pos += 4
                        except ValueError:
                            result.append('\\u')
                    else:
                        result.append('\\u')
                else:
                    result.append('\\')
                    result.append(next_c)
            elif c == '"':
                break  # End of string
            else:
                result.append(c)
            pos += 1
        return ''.join(result)

    def _strip_html(self, html_str: str) -> str:
        """Strip HTML tags and return plain text."""
        if not html_str:
            return ""
        soup = BeautifulSoup(html_str, "lxml")
        text = soup.get_text(separator=' ')
        return re.sub(r'\s+', ' ', text).strip()

    async def import_from_picturethis(self, url: str) -> Dict[str, Any]:
        """
        Scrape plant data from PictureThis AI (picturethisai.com).
        Supports /wiki/ and /care/ URLs. If given a /wiki/ URL, also fetches /care/ for extra data.
        Data is embedded as double-encoded JSON in window.detail and window.careDetails.
        """
        parsed = urlparse(url)
        path = parsed.path.rstrip('/')

        # Normalize to get the latin name slug from any URL pattern
        # /wiki/Citrus_limon.html, /care/Citrus_limon.html, /care/propagate/Citrus_limon.html
        latin_slug = path.split('/')[-1].replace('.html', '')
        wiki_url = f"https://www.picturethisai.com/wiki/{latin_slug}.html"
        care_url = f"https://www.picturethisai.com/care/{latin_slug}.html"

        pt_headers = {
            **self.headers,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        data = {}
        data["latin_name"] = latin_slug.replace('_', ' ')

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            # Fetch wiki page (primary data)
            wiki_response = await client.get(wiki_url, headers=pt_headers)
            wiki_response.raise_for_status()
            self._validate_response_url(wiki_response, "picturethisai.com")

            wiki_json = self._unescape_js_string(wiki_response.text, 'window.detail')
            if wiki_json:
                try:
                    wiki_data = json.loads(wiki_json)
                    self._parse_picturethis_wiki(data, wiki_data)
                except json.JSONDecodeError as e:
                    logger.warning(f"PictureThis wiki JSON parse error: {e}")

            # Fetch care page (supplementary data)
            try:
                care_response = await client.get(care_url, headers=pt_headers)
                care_response.raise_for_status()
                self._validate_response_url(care_response, "picturethisai.com")

                care_json = self._unescape_js_string(care_response.text, 'window.careDetails')
                if care_json:
                    try:
                        care_data = json.loads(care_json)
                        self._parse_picturethis_care(data, care_data)
                    except json.JSONDecodeError as e:
                        logger.warning(f"PictureThis care JSON parse error: {e}")
            except Exception as e:
                logger.warning(f"PictureThis care page fetch failed: {e}")

        # Add source reference
        data["references"] = f"Source: {wiki_url}"

        logger.debug(f"PictureThis parsed data: {data}")
        return self._map_to_plant_model(data, wiki_url)

    def _parse_picturethis_wiki(self, data: Dict, wiki: Dict):
        """Parse PictureThis wiki page JSON data."""
        # Main image
        if wiki.get('mainImageUrl'):
            data['image_url'] = wiki['mainImageUrl']

        # Common name
        if wiki.get('displayName'):
            data['name'] = wiki['displayName']

        # Description
        basic_info = wiki.get('basicInfo', {})
        if basic_info.get('descriptionValue'):
            data['description'] = basic_info['descriptionValue']

        # Family from taxonomy
        for entry in basic_info.get('taxonomyList', []):
            if entry.get('type') == 'Family':
                # Name might be common family name like "Rue", extract from link
                link = entry.get('link', '')
                if link:
                    # /wiki/Rutaceae.html -> Rutaceae
                    family = link.split('/')[-1].replace('.html', '')
                    data['family'] = family
                elif entry.get('name'):
                    data['family'] = entry['name']

        # Key facts
        for kf in basic_info.get('keyFactsConfigs', []):
            name = kf.get('name', '')
            title = kf.get('title', '')
            value = kf.get('value')
            if value is None or value == '?':
                continue

            # Strip HTML if value contains tags
            if isinstance(value, str) and '<' in value:
                value = self._strip_html(value)
            if not value:
                continue

            if 'PlantHeight' in name or title == 'Plant Height':
                data['height'] = value
            elif 'CrownDiameter' in name or title == 'Spread':
                data['width'] = value
            elif 'HarvestTime' in name or title == 'Harvest Time':
                data['produces_months'] = value
            elif 'PreferredTemperature' in name or title == 'Ideal Temperature':
                self._parse_picturethis_temperature(data, value)
            elif 'PlantEvergreen' in name or title == 'Leaf type':
                if 'evergreen' in value.lower():
                    data['evergreen'] = True
            elif title == 'Toxicity':
                if 'toxic' in value.lower():
                    data['toxicity_note'] = value
            elif title == 'Plant Type':
                data['plant_type'] = value
            elif title == 'Lifespan':
                data['lifespan'] = value

        # Care guide labels (quick reference)
        care_guide = wiki.get('careGuide', {})
        for label in care_guide.get('labels', []):
            title = label.get('title', '')
            value = label.get('value', '')
            if not value:
                continue

            if title == 'Water':
                data['water_label'] = value
            elif title == 'Sunlight':
                self._parse_picturethis_sunlight(data, value)
            elif title == 'Ideal Temperature' and 'min_temp' not in data:
                self._parse_picturethis_temperature(data, value)

        # Care guide summaries (detailed text)
        for summary in care_guide.get('summarys', []):
            title = summary.get('title', '')
            value = self._strip_html(summary.get('value', ''))
            if not value:
                continue

            if title == 'Water':
                data['water_notes'] = value[:500]
            elif title == 'Fertilize':
                existing = data.get('cultivation', '')
                data['cultivation'] = f"{existing}\n\nFertilizing: {value[:500]}".strip()
            elif title == 'Pruning':
                existing = data.get('cultivation', '')
                data['cultivation'] = f"{existing}\n\nPruning: {value[:500]}".strip()
            elif title == 'Propagation':
                data['propagation_text'] = value[:500]

        # Distribution
        dist = wiki.get('distribution', {})
        if dist.get('habitat'):
            data['habitat'] = dist['habitat']
        if dist.get('nativeRange'):
            data['native_range'] = dist['nativeRange']

        # Toxicity
        toxic = wiki.get('toxic', {})
        if toxic.get('summary'):
            toxicity_text = self._strip_html(toxic['summary'])
            if toxicity_text:
                data['known_hazards'] = toxicity_text

        # Culture info (uses)
        culture = wiki.get('cultureInfo', {})
        uses_parts = []
        for item in culture.get('list', []):
            title = item.get('title', '')
            value = item.get('value', '')
            if not value or title in ['Symbolism', 'Interesting Facts']:
                continue
            if isinstance(value, str) and '<' in value:
                value = self._strip_html(value)
            if value:
                uses_parts.append(f"{title}: {value}")
        if uses_parts:
            data['culture_uses'] = '; '.join(uses_parts)

    def _parse_picturethis_care(self, data: Dict, care: Dict):
        """Parse PictureThis care page JSON data."""
        # Essential care tips
        essential = care.get('essentialCareTips', {})
        for item in essential.get('list', []):
            title = item.get('title', '')
            value = item.get('value', '')
            if not value or value == '?':
                continue
            # Strip HTML if present
            if isinstance(value, str) and '<' in value:
                value = self._strip_html(value)

            if title == 'Hardiness Zones':
                data['grow_zones'] = value
            elif title == 'Soil pH' and 'soil_ph' not in data:
                data['soil_ph'] = value
            elif title == 'Planting Time':
                data['planting_time'] = value
            elif title == 'Toughness':
                if value.lower() == 'high':
                    data['drought_tolerant'] = True

        # How-tos: extract labels for structured data
        for howto in care.get('howTos', []):
            title = howto.get('title', '').lower()
            labels = {l.get('title', ''): l.get('value', '') for l in howto.get('labels', []) if l.get('value')}
            logger.debug(f"PictureThis howTo '{howto.get('title', '')}': labels={list(labels.keys())}")
            # Also capture the how-to description text
            howto_desc = howto.get('description', '')
            if isinstance(howto_desc, str) and '<' in howto_desc:
                howto_desc = self._strip_html(howto_desc)

            if 'water' in title:
                if 'Watering schedule' in labels and 'water_label' not in data:
                    data['water_label'] = labels['Watering schedule']
                # Extract all watering details for cultivation_details
                water_details = []
                for key in ['Watering Amount', 'Best Time to Water', 'Tips']:
                    if key in labels:
                        water_details.append(f"{key}: {labels[key]}")
                if water_details:
                    data['water_details'] = '; '.join(water_details)
            elif 'sunlight' in title:
                if 'Sunlight Requirements' in labels and 'sun_requirement' not in data:
                    self._parse_picturethis_sunlight(data, labels['Sunlight Requirements'])
            elif 'temperature' in title:
                if 'Temperature Tolerance' in labels:
                    self._parse_picturethis_temp_tolerance(data, labels['Temperature Tolerance'])
                if 'Ideal Temperature' in labels and 'ideal_temp' not in data:
                    self._parse_picturethis_temperature(data, labels['Ideal Temperature'])
            elif 'soil' in title:
                if 'Soil Composition' in labels:
                    data['soil_type'] = labels['Soil Composition']
                if 'Soil pH' in labels and 'soil_ph' not in data:
                    data['soil_ph'] = labels['Soil pH']
            elif 'fertiliz' in title:
                # Extract fertilizing schedule details
                fert_details = []
                for key in ['Fertilizing Frequency', 'Fertilizer Type', 'Fertilizing Period', 'Tips']:
                    if key in labels:
                        fert_details.append(f"{key}: {labels[key]}")
                if fert_details:
                    data['fertilize_details'] = '; '.join(fert_details)
                if 'Fertilizing Frequency' in labels:
                    data['fertilize_frequency_label'] = labels['Fertilizing Frequency']
                if 'Fertilizer Type' in labels:
                    data['fertilizer_type'] = labels['Fertilizer Type']
            elif 'prune' in title or 'pruning' in title:
                if 'Pruning Time' in labels:
                    data['prune_months'] = labels['Pruning Time']
                # Extract pruning technique/frequency details
                prune_details = []
                for key in ['Pruning Techniques', 'Pruning Steps', 'Tips']:
                    if key in labels:
                        prune_details.append(f"{key}: {labels[key]}")
                if prune_details:
                    data['prune_details'] = '; '.join(prune_details)
                if howto_desc and 'prune_frequency_text' not in data:
                    data['prune_frequency_text'] = howto_desc[:300]
            elif 'harvest' in title:
                # Extract harvest details
                harvest_details = []
                for key in ['Harvest Time', 'Harvest Frequency', 'Harvesting Techniques', 'Tips']:
                    if key in labels:
                        harvest_details.append(f"{key}: {labels[key]}")
                if 'Harvest Time' in labels and 'produces_months' not in data:
                    data['produces_months'] = labels['Harvest Time']
                if 'Harvest Frequency' in labels:
                    data['harvest_frequency_label'] = labels['Harvest Frequency']
                if howto_desc and 'how_to_harvest' not in data:
                    data['how_to_harvest'] = howto_desc[:500]
                if harvest_details:
                    data['harvest_details'] = '; '.join(harvest_details)
            elif 'propagat' in title:
                if 'Propagation Type' in labels:
                    data['propagation_methods'] = labels['Propagation Type']
                if 'Propagation Time' in labels:
                    existing = data.get('propagation_text', '')
                    if existing:
                        data['propagation_text'] = f"{existing} Best time: {labels['Propagation Time']}."
            elif 'plant' in title and 'transplant' not in title and 'repot' not in title:
                if 'Planting Time' in labels and 'planting_time' not in data:
                    data['planting_time'] = labels['Planting Time']

    def _parse_picturethis_sunlight(self, data: Dict, value: str):
        """Parse sunlight requirement from PictureThis."""
        lower = value.lower()
        if 'full sun' in lower and 'partial' not in lower:
            data['sun_requirement'] = 'full_sun'
        elif 'partial sun' in lower or ('full sun' in lower and 'partial' in lower):
            data['sun_requirement'] = 'partial_sun'
        elif 'partial shade' in lower:
            data['sun_requirement'] = 'partial_shade'
        elif 'full shade' in lower:
            data['sun_requirement'] = 'full_shade'

    def _parse_picturethis_temperature(self, data: Dict, value: str):
        """Parse temperature range from PictureThis (e.g., '20 - 38 ℃')."""
        # Match patterns like "20 - 38 ℃" or "20-38℃"
        match = re.search(r'(-?\d+)\s*[-–]\s*(-?\d+)\s*℃', value)
        if match:
            low_c = int(match.group(1))
            high_c = int(match.group(2))
            data['ideal_temp'] = f"{celsius_to_fahrenheit(low_c)}-{celsius_to_fahrenheit(high_c)}°F"

    def _parse_picturethis_temp_tolerance(self, data: Dict, value: str):
        """Parse temperature tolerance from PictureThis care page (e.g., '0 - 43 ℃')."""
        match = re.search(r'(-?\d+)\s*[-–]\s*(-?\d+)\s*℃', value)
        if match:
            low_c = int(match.group(1))
            high_c = int(match.group(2))
            data['min_temp'] = celsius_to_fahrenheit(low_c)
            # If can't survive below freezing, it's frost sensitive
            if low_c >= 0:
                data['frost_sensitive'] = True
            else:
                data['frost_sensitive'] = False

    def _water_label_to_schedule(self, label: str) -> Optional[str]:
        """Convert a watering frequency label to seasonal schedule format.
        Returns format: 'summer:X,winter:Y,spring:Z,fall:W' (days between watering)
        """
        label = label.lower()
        if "daily" in label or "every day" in label:
            return "summer:1,winter:3,spring:2,fall:2"
        elif "every 2-3 days" in label or "2-3 days" in label:
            return "summer:2,winter:5,spring:3,fall:4"
        elif "twice a week" in label or "every 3-4 days" in label:
            return "summer:3,winter:7,spring:4,fall:5"
        elif "once a week" in label or "weekly" in label or "every week" in label:
            return "summer:5,winter:10,spring:7,fall:7"
        elif "1-2 weeks" in label or "every 1-2 weeks" in label:
            return "summer:7,winter:14,spring:10,fall:10"
        elif "every 2 weeks" in label or "2-3 weeks" in label:
            return "summer:10,winter:21,spring:14,fall:14"
        elif "every 3 weeks" in label or "3-4 weeks" in label:
            return "summer:14,winter:28,spring:21,fall:21"
        elif "monthly" in label or "once a month" in label:
            return "summer:21,winter:30,spring:28,fall:28"
        return None

    def _fertilize_label_to_schedule(self, label: str) -> Optional[str]:
        """Convert a fertilizing frequency label to seasonal schedule format.
        Returns format: 'spring:X,summer:Y,fall:Z,winter:0' (days between, 0=none)
        """
        label = label.lower()
        if "weekly" in label or "every week" in label:
            return "spring:7,summer:7,fall:14,winter:0"
        elif "every 2 weeks" in label or "biweekly" in label or "twice a month" in label:
            return "spring:14,summer:14,fall:21,winter:0"
        elif "monthly" in label or "once a month" in label:
            return "spring:30,summer:30,fall:45,winter:0"
        elif "every 2 months" in label or "every 6-8 weeks" in label:
            return "spring:45,summer:45,fall:60,winter:0"
        elif "every 3 months" in label or "quarterly" in label:
            return "spring:60,summer:60,fall:90,winter:0"
        elif "once" in label or "once a year" in label or "annually" in label:
            return "spring:365,summer:0,fall:0,winter:0"
        return None

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
            "frost_sensitive", "drought_tolerant", "salt_tolerant",
            "propagation_methods", "references", "plant_spacing",
            "produces_months",
        ]

        for field in direct_fields:
            if field in data and data[field] is not None:
                result[field] = data[field]

        # Text fields that may contain metric measurements - convert to imperial
        text_fields_to_convert = [
            "description", "soil_requirements", "size_full_grown",
            "uses", "known_hazards", "how_to_harvest",
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

        # Map edible_uses (Growables: food/culinary sections)
        if "edible_uses" in data and data["edible_uses"]:
            result["uses"] = data["edible_uses"]

        # Map medicinal_uses -> append to uses
        if "medicinal_uses" in data and data["medicinal_uses"]:
            existing = result.get("uses", "")
            if existing:
                result["uses"] = f"{existing}; Medicinal: {data['medicinal_uses']}"
            else:
                result["uses"] = f"Medicinal: {data['medicinal_uses']}"

        # Map other_uses -> append to uses
        if "other_uses" in data and data["other_uses"]:
            existing = result.get("uses", "")
            if existing:
                result["uses"] = f"{existing}; {data['other_uses']}"
            else:
                result["uses"] = data["other_uses"]

        # Map pest/disease notes -> special_considerations or known_hazards
        if "pest_disease_notes" in data and data["pest_disease_notes"]:
            existing = result.get("known_hazards", "")
            if existing:
                result["known_hazards"] = f"{existing}; Pests/Diseases: {data['pest_disease_notes']}"
            else:
                result["known_hazards"] = f"Pests/Diseases: {data['pest_disease_notes']}"

        # Build size_full_grown from height + width if not already set
        if "size_full_grown" not in result:
            parts = []
            if "height" in data and data["height"]:
                parts.append(f"Height: {convert_metric_measurements(data['height'])}")
            if "width" in data and data["width"]:
                parts.append(f"Spread: {convert_metric_measurements(data['width'])}")
            if parts:
                result["size_full_grown"] = "; ".join(parts)

        # Map water notes to cultivation_details if no moisture_preference found
        if "water_notes" in data and data["water_notes"]:
            if "moisture_preference" not in result:
                moisture = self._extract_moisture_preference(data["water_notes"])
                if moisture:
                    result["moisture_preference"] = moisture
            # Also append watering info to cultivation_details
            existing = result.get("cultivation_details", "")
            if existing:
                result["cultivation_details"] = f"{existing}\n\nWatering: {data['water_notes']}"
            else:
                result["cultivation_details"] = f"Watering: {data['water_notes']}"

        # Map water_label to moisture_preference and water_schedule (PictureThis)
        if "water_label" in data:
            wl = data["water_label"].lower()
            if "moisture_preference" not in result:
                if "daily" in wl or "every day" in wl or "every 2-3 days" in wl:
                    result["moisture_preference"] = "moist_wet"
                elif "1-2 weeks" in wl or "once a week" in wl or "weekly" in wl or "every week" in wl:
                    result["moisture_preference"] = "moist"
                elif "2-3 weeks" in wl or "infrequent" in wl or "every 2 weeks" in wl:
                    result["moisture_preference"] = "dry_moist"
                elif "3-4 weeks" in wl or "rarely" in wl or "every 3 weeks" in wl or "monthly" in wl:
                    result["moisture_preference"] = "dry"

            # Generate water_schedule from water_label
            if "water_schedule" not in result:
                schedule = self._water_label_to_schedule(wl)
                if schedule:
                    result["water_schedule"] = schedule

        # Map water_details to cultivation_details
        if "water_details" in data and data["water_details"]:
            existing = result.get("cultivation_details", "")
            water_info = f"Watering details: {data['water_details']}"
            if existing:
                result["cultivation_details"] = f"{existing}\n\n{water_info}"
            else:
                result["cultivation_details"] = water_info

        # Map fertilize_frequency_label to fertilize_schedule (PictureThis)
        if "fertilize_frequency_label" in data:
            fl = data["fertilize_frequency_label"].lower()
            schedule = self._fertilize_label_to_schedule(fl)
            if schedule:
                result["fertilize_schedule"] = schedule

        # Map fertilize_details to cultivation_details
        if "fertilize_details" in data and data["fertilize_details"]:
            existing = result.get("cultivation_details", "")
            fert_info = f"Fertilizing: {data['fertilize_details']}"
            if existing:
                result["cultivation_details"] = f"{existing}\n\n{fert_info}"
            else:
                result["cultivation_details"] = fert_info

        # Map prune_frequency_text and prune_details (PictureThis)
        if "prune_frequency_text" in data and data["prune_frequency_text"]:
            result["prune_frequency"] = data["prune_frequency_text"][:100]
        if "prune_details" in data and data["prune_details"]:
            existing = result.get("cultivation_details", "")
            prune_info = f"Pruning: {data['prune_details']}"
            if existing:
                result["cultivation_details"] = f"{existing}\n\n{prune_info}"
            else:
                result["cultivation_details"] = prune_info

        # Map harvest_frequency_label and harvest_details (PictureThis)
        if "harvest_frequency_label" in data and data["harvest_frequency_label"]:
            result["harvest_frequency"] = data["harvest_frequency_label"]
        if "how_to_harvest" in data and data["how_to_harvest"] and "how_to_harvest" not in result:
            result["how_to_harvest"] = convert_metric_measurements(data["how_to_harvest"])

        # Map soil_type to soil_requirements (PictureThis)
        if "soil_type" in data and data["soil_type"]:
            existing = result.get("soil_requirements", "")
            soil_info = f"Soil: {data['soil_type']}"
            if existing:
                result["soil_requirements"] = f"{soil_info}; {existing}"
            else:
                result["soil_requirements"] = soil_info

        # Map prune_months (PictureThis care page)
        if "prune_months" in data and data["prune_months"]:
            result["prune_months"] = data["prune_months"]

        # Map propagation_text to propagation_methods if not already set
        if "propagation_text" in data and "propagation_methods" not in result:
            prop_text = data["propagation_text"].lower()
            methods = []
            if "seed" in prop_text or "sowing" in prop_text:
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
                result["propagation_methods"] = ", ".join(methods)

        # Map culture_uses to uses (PictureThis)
        if "culture_uses" in data and data["culture_uses"]:
            existing = result.get("uses", "")
            if existing:
                result["uses"] = f"{existing}; {data['culture_uses']}"
            else:
                result["uses"] = data["culture_uses"]

        # Map planting_time to cultivation_details (PictureThis)
        if "planting_time" in data and data["planting_time"]:
            existing = result.get("cultivation_details", "")
            planting_info = f"Planting time: {data['planting_time']}"
            if existing:
                result["cultivation_details"] = f"{planting_info}\n\n{existing}"
            else:
                result["cultivation_details"] = planting_info

        # Pass through image_url for import download
        if "image_url" in data and data["image_url"]:
            result["image_url"] = data["image_url"]

        logger.debug(f"Mapped plant data: {result}")
        return result


# Singleton instance
plant_import_service = PlantImportService()
