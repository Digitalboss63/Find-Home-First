/**
 * Geographic resolver — parses project.community into GeoContext.
 *
 * project.community format: "City, ST" e.g. "Atlanta, GA"
 *
 * Returns best-effort context. Fields that cannot be determined are null.
 * No network calls — uses a static lookup table for major metros.
 */
import type { GeoContext } from "./types";

// State FIPS codes
const STATE_FIPS: Record<string, string> = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",
  FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",
  KY:"21",LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",MS:"28",
  MO:"29",MT:"30",NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",NY:"36",
  NC:"37",ND:"38",OH:"39",OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",
  SD:"46",TN:"47",TX:"48",UT:"49",VT:"50",VA:"51",WA:"53",WV:"54",
  WI:"55",WY:"56",DC:"11",
};

interface MetroKnowledge {
  county: string;
  metro: string;
  fmrArea: string;
  cocId: string;
  cocName: string;
  phaName: string;
}

// Static known metros — extend as needed
const METRO_LOOKUP: Record<string, MetroKnowledge> = {
  "atlanta,ga": {
    county: "Fulton County",
    metro: "Atlanta-Sandy Springs-Alpharetta, GA MSA",
    fmrArea: "Atlanta-Sandy Springs-Alpharetta HMFA",
    cocId: "GA-500",
    cocName: "Atlanta CoC (GA-500)",
    phaName: "Atlanta Housing",
  },
  "los angeles,ca": {
    county: "Los Angeles County",
    metro: "Los Angeles-Long Beach-Anaheim, CA MSA",
    fmrArea: "Los Angeles-Long Beach-Glendale HMFA",
    cocId: "CA-600",
    cocName: "Los Angeles City & County CoC (CA-600)",
    phaName: "Housing Authority of the City of Los Angeles",
  },
  "new york,ny": {
    county: "New York County",
    metro: "New York-Newark-Jersey City, NY-NJ-PA MSA",
    fmrArea: "New York, NY HMFA",
    cocId: "NY-600",
    cocName: "New York City CoC (NY-600)",
    phaName: "New York City Housing Authority",
  },
  "houston,tx": {
    county: "Harris County",
    metro: "Houston-The Woodlands-Sugar Land, TX MSA",
    fmrArea: "Houston-The Woodlands-Sugar Land HMFA",
    cocId: "TX-700",
    cocName: "Houston, Pasadena, Conroe/Harris County CoC (TX-700)",
    phaName: "Houston Housing Authority",
  },
  "phoenix,az": {
    county: "Maricopa County",
    metro: "Phoenix-Mesa-Chandler, AZ MSA",
    fmrArea: "Phoenix-Mesa-Scottsdale HMFA",
    cocId: "AZ-502",
    cocName: "Phoenix, Mesa/Maricopa County CoC (AZ-502)",
    phaName: "Maricopa County Housing Authority",
  },
  "dallas,tx": {
    county: "Dallas County",
    metro: "Dallas-Fort Worth-Arlington, TX MSA",
    fmrArea: "Dallas-Plano-Irving HMFA",
    cocId: "TX-600",
    cocName: "Dallas City & County, Collin County CoC (TX-600)",
    phaName: "Dallas Housing Authority",
  },
  "chicago,il": {
    county: "Cook County",
    metro: "Chicago-Naperville-Elgin, IL-IN-WI MSA",
    fmrArea: "Chicago-Joliet-Naperville HMFA",
    cocId: "IL-510",
    cocName: "Chicago CoC (IL-510)",
    phaName: "Chicago Housing Authority",
  },
  "seattle,wa": {
    county: "King County",
    metro: "Seattle-Tacoma-Bellevue, WA MSA",
    fmrArea: "Seattle-Bellevue HMFA",
    cocId: "WA-500",
    cocName: "Seattle/King County CoC (WA-500)",
    phaName: "King County Housing Authority",
  },
  "denver,co": {
    county: "Denver County",
    metro: "Denver-Aurora-Lakewood, CO MSA",
    fmrArea: "Denver-Aurora-Lakewood HMFA",
    cocId: "CO-503",
    cocName: "Metropolitan Denver CoC (CO-503)",
    phaName: "Denver Housing Authority",
  },
  "charlotte,nc": {
    county: "Mecklenburg County",
    metro: "Charlotte-Concord-Gastonia, NC-SC MSA",
    fmrArea: "Charlotte-Concord-Gastonia HMFA",
    cocId: "NC-505",
    cocName: "Charlotte/Mecklenburg County CoC (NC-505)",
    phaName: "Charlotte Housing Authority",
  },
};

/**
 * Resolves a project.community string like "Atlanta, GA" into a GeoContext.
 * Returns null city/state if the format is unrecognizable.
 */
export function resolveGeography(community: string): GeoContext {
  const parts = community.split(",").map((s) => s.trim());
  const city = parts[0] ?? community.trim();
  const stateAbbr = (parts[1] ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const stateFips = STATE_FIPS[stateAbbr] ?? null;

  const lookupKey = `${city.toLowerCase()},${stateAbbr.toLowerCase()}`;
  const metro = METRO_LOOKUP[lookupKey] ?? null;

  return {
    city,
    stateAbbr: stateAbbr || "??",
    stateFips: stateFips ?? "00",
    county: metro?.county ?? null,
    metro: metro?.metro ?? null,
    fmrArea: metro?.fmrArea ?? null,
    cocId: metro?.cocId ?? null,
    cocName: metro?.cocName ?? null,
    phaName: metro?.phaName ?? null,
  };
}
