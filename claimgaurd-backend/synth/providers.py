from __future__ import annotations

import random
import string
from datetime import date

from faker.providers import BaseProvider


class KenyaPersonProvider(BaseProvider):
    """Structurally realistic Kenyan personal identity data — no real persons."""

    COUNTY_WEIGHTS = {
        "Nairobi": 22, "Kiambu": 7, "Mombasa": 6, "Nakuru": 6, "Kakamega": 5,
        "Bungoma": 4, "Machakos": 4, "Kisumu": 4, "Meru": 3, "Kilifi": 3,
        "Uasin Gishu": 3, "Nyeri": 2, "Embu": 2, "Laikipia": 2, "Trans Nzoia": 2,
        "Kericho": 2, "Bomet": 1, "Murang'a": 2, "Nyandarua": 1, "Lamu": 1,
        "Kwale": 1, "Taita Taveta": 1, "Tana River": 1, "Garissa": 1, "Wajir": 1,
        "Marsabit": 1, "Isiolo": 1, "Tharaka Nithi": 1, "Kirinyaga": 2,
        "Nandi": 1, "Baringo": 1, "Elgeyo Marakwet": 1, "Samburu": 1,
        "West Pokot": 1, "Turkana": 1, "Siaya": 1, "Homa Bay": 1,
        "Migori": 1, "Kisii": 2, "Nyamira": 1, "Narok": 1, "Kajiado": 2,
        "Makueni": 1, "Kitui": 1, "Vihiga": 1, "Mandera": 1,
    }

    FIRST_NAMES_MALE = [
        "James", "John", "Peter", "David", "Paul", "Joseph", "Daniel", "Samuel",
        "Michael", "Patrick", "George", "Charles", "Robert", "Anthony", "Francis",
        "Omar", "Hassan", "Abdi", "Mohamed", "Ibrahim",
        "Waweru", "Kamau", "Njoroge", "Mwangi", "Kariuki",
        "Omondi", "Otieno", "Odhiambo", "Onyango", "Owino",
        "Kipchoge", "Rotich", "Koech", "Mutai", "Bett",
        "Mutua", "Ndungu", "Gitonga", "Ngugi", "Kimani",
    ]
    FIRST_NAMES_FEMALE = [
        "Mary", "Grace", "Faith", "Joyce", "Caroline", "Ann", "Lucy", "Sarah",
        "Fatuma", "Maryam", "Amina", "Rahma",
        "Wanjiku", "Njeri", "Wanjiru", "Wairimu", "Nyambura",
        "Akinyi", "Awino", "Adhiambo", "Atieno",
        "Chebet", "Jelimo", "Chepkoech", "Cherono",
    ]
    SURNAMES = [
        "Mwangi", "Kamau", "Odhiambo", "Otieno", "Njoroge", "Kariuki",
        "Hassan", "Omar", "Abdullahi", "Koech", "Ruto", "Kipchoge",
        "Mutua", "Ndungu", "Waweru", "Gitonga", "Ngugi", "Kimani",
        "Ouma", "Achieng", "Owino", "Odero", "Onyango",
        "Rotich", "Bett", "Mutai", "Kiplangat", "Cherono", "Ngetich",
        "Muthoni", "Wambui", "Njoki", "Wangari",
    ]

    def kenyan_full_name(self) -> str:
        gender = self.random_element(["male", "female"])
        first = self.random_element(
            self.FIRST_NAMES_MALE if gender == "male" else self.FIRST_NAMES_FEMALE
        )
        return f"{first} {self.random_element(self.SURNAMES)}"

    def national_id(self) -> str:
        return str(self.random_int(min=10_000_000, max=39_999_999))

    def kra_pin(self) -> str:
        digits = str(self.random_int(100_000_000, 999_999_999))
        letter = random.choice(string.ascii_uppercase)
        return f"A{digits}{letter}"

    def ke_phone(self) -> str:
        prefix = self.random_element(["0700", "0711", "0722", "0733", "0740", "0757", "0768"])
        suffix = str(self.random_int(100_000, 999_999))
        return f"{prefix}{suffix}"

    def ke_county(self) -> str:
        counties = list(self.COUNTY_WEIGHTS.keys())
        weights = list(self.COUNTY_WEIGHTS.values())
        return random.choices(counties, weights=weights, k=1)[0]


class KenyaVehicleProvider(BaseProvider):
    """Kenya NTSA-format vehicle data."""

    MAKES_WEIGHTS = {
        "Toyota": 45, "Nissan": 15, "Isuzu": 8, "Mazda": 7,
        "Mitsubishi": 6, "Subaru": 5, "Honda": 4,
        "Mercedes-Benz": 3, "BMW": 2, "Other": 5,
    }
    MODELS = {
        "Toyota": ["Vitz", "Fielder", "Probox", "Premio", "Axio", "Hiace", "Land Cruiser", "RAV4", "Prado"],
        "Nissan": ["Note", "Tiida", "X-Trail", "Navara", "Sunny"],
        "Isuzu": ["D-MAX", "N-Series", "NQR"],
        "Mazda": ["Demio", "Atenza", "CX-5"],
        "Mitsubishi": ["Outlander", "Pajero", "L200"],
        "Subaru": ["Forester", "Outback", "Impreza"],
        "Honda": ["Fit", "CR-V", "Accord"],
        "Mercedes-Benz": ["C-Class", "E-Class", "GLC"],
        "BMW": ["3 Series", "5 Series", "X5"],
        "Other": ["Peugeot 307", "VW Polo", "Ford Ranger"],
    }
    USE_TYPES_WEIGHTS = {"private": 65, "commercial": 25, "psv": 10}

    def ke_registration(self) -> str:
        letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
        series = f"K{random.choice(letters)}{random.choice(letters)}"
        number = self.random_int(100, 999)
        suffix = random.choice(letters)
        return f"{series} {number}{suffix}"

    def vehicle_make(self) -> str:
        makes = list(self.MAKES_WEIGHTS.keys())
        weights = list(self.MAKES_WEIGHTS.values())
        return random.choices(makes, weights=weights, k=1)[0]

    def vehicle_model(self, make: str) -> str:
        return self.random_element(self.MODELS.get(make, ["Unknown"]))

    def vehicle_year(self) -> int:
        return self.random_int(2004, 2022)

    def vehicle_use_type(self) -> str:
        uses = list(self.USE_TYPES_WEIGHTS.keys())
        weights = list(self.USE_TYPES_WEIGHTS.values())
        return random.choices(uses, weights=weights, k=1)[0]

    def chassis_number(self) -> str:
        chars = string.ascii_uppercase + string.digits
        return "".join(random.choices(chars, k=17))

    def engine_number(self) -> str:
        chars = string.ascii_uppercase + string.digits
        return "".join(random.choices(chars, k=10))


class KenyaInsuranceProvider(BaseProvider):
    """InsureMaster-shaped reference codes."""

    BRANCHES = [
        ("NBR001", "Nairobi CBD"), ("NBR002", "Westlands"), ("NBR003", "Upperhill"),
        ("MSA001", "Mombasa"), ("NKR001", "Nakuru"), ("KSM001", "Kisumu"),
        ("ELD001", "Eldoret"), ("THK001", "Thika"), ("NYR001", "Nyeri"),
        ("GRS001", "Garissa"),
    ]
    REPAIRERS = [
        "Fast Fix Garage", "City Motors", "Highway Autos", "Elite Panels",
        "Nairobi Auto Centre", "Coast Repairers", "Premier Body Works",
        "Rift Valley Motors", "Westlands Garage", "Industrial Area Autos",
        "Thika Road Motors", "Langata Auto Clinic", "CBD Panel Beaters",
        "Mombasa Road Motors", "Eastlands Auto", "Parklands Garage",
        "Ngong Road Repairers", "Enterprise Autos", "Embakasi Body Works",
        "South B Motors",
    ]

    def policy_number(self, motor_class: str, year: int) -> str:
        prefix = {"comprehensive": "CMP/MOT", "tpft": "TPFT/MOT", "third_party": "TPO/MOT"}.get(
            motor_class, "CMP/MOT"
        )
        # Use 7-digit range to keep collision probability very low across multiple seeds
        seq = self.random_int(100000, 9999999)
        return f"{prefix}/{year}/{seq:07d}"

    def claim_reference(self, year: int) -> str:
        seq = self.random_int(1000, 999999)
        return f"CLM/{year}/{seq:07d}"

    def ob_number(self, county: str, year: int) -> str:
        prefix = county[:3].upper()
        seq = self.random_int(1000, 99999)
        return f"OB/{prefix}/{year}/{seq}"

    def branch(self) -> tuple:
        return self.random_element(self.BRANCHES)

    def repairer_name(self) -> str:
        return self.random_element(self.REPAIRERS)
