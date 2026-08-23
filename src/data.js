/* All of the tool's local knowledge in one module: berths, codes,
   sections, fleets and rule tables for every engine. Corrections belong
   here, not in the engines. */
"use strict";
const SHEETS_DATA = (() => {

/* ==== shared berth/destination reference (ex core) ==== */
const DEST_TLC = {
  "VICTORIA": "VIC", "VICTORIA (E)": "VIC", "CHARING CROSS": "CHX",
  "CANNON STREET": "CST", "LONDON BRIDGE": "LBG", "LONDON BRIDGE (E)": "LBG",
  "LONDON BLACKFRIARS": "BFR", "ST. PANCRAS INT": "STP", "ST PANCRAS INTL": "STP",
  "DOVER PRIORY": "DVP", "RAMSGATE": "RAM", "MARGATE": "MAR",
  "BROADSTAIRS": "BSR", "MINSTER": "MSR", "SANDWICH": "SDW",
  "CANTERBURY WEST": "CBW", "ASHFORD": "AFK", "ASHFORD INTL": "AFK",
  "FOLKESTONE CENTRAL": "FKC", "FOLKESTONE EAST": "FKE",
  "MAIDSTONE EAST": "MDE", "MAIDSTONE WEST": "MDW", "GILLINGHAM": "GLM",
  "STROOD": "SOO", "SHEERNESS-ON-SEA": "SSS", "SITTINGBOURNE": "SIT",
  "HERNE BAY": "HNB",
  "FAVERSHAM": "FAV", "ROCHESTER": "RTR", "PADDOCK WOOD": "PDW",
  "TONBRIDGE": "TON", "TUNBRIDGE WELLS": "TBW", "SEVENOAKS": "SEV",
  "SEVENOAKS C.H.S": "SEV", "ORPINGTON": "ORP", "GROVE PARK": "GPK",
  "HAYES": "HYS", "HAYES (KENT)": "HYS", "LEE": "LEE", "LEWISHAM": "LEW",
  "NEW CROSS": "NWX", "DARTFORD": "DFD", "GRAVESEND": "GRV",
  "SLADE GREEN": "SGR", "BARNEHURST": "BNH", "CRAYFORD": "CRY",
  "PLUMSTEAD": "PLU", "HASTINGS": "HGS", "ORE": "ORE",
  "HERNE HILL": "HNH", "BECKENHAM JUNCTION": "BKJ", "BROMLEY NORTH": "BMN",
  "SWANLEY": "SAY", "EBBSFLEET INTERNATIONAL": "EBD",
  "SELHURST DEPOT": "SEL", "STEWARTS LANE": "SL", "SIDCUP": "SID",
  "BELLINGHAM": "BGM", "CRANMORE": "CRANMORE", "LONDON BRIDGE (VIA ORP)": "LBG",
};
const BERTH_SHEETS = {
  "ASHFORD DOWN SIDINGS": ["ASHFORD", "AFK", null, "AFK"],
  "ASHFORD DOWN WASHER RD": ["ASHFORD", "AFK", null, "AFK"],
  "ASHFORD DOWN YARD": ["ASHFORD", "AFK", null, "AFK"],
  "ASHFORD DY CANTEBURY END": ["ASHFORD", "AFK", null, "AFK"],
  "ASHFORD UP SIDINGS": ["ASHFORD", "AFU", "UP SIDINGS", "AFK"],
  "ASHFORD EAST BTH SDGS": ["ASHFORD", "AFE", "EAST SIDINGS", "AFK"],
  "ASHFORD": ["ASHFORD", "AFK", null, "AFK"],
  "DOVER PRIORY SIDINGS": ["DOVER PRIORY", "DVP", null, "DVP"],
  "DOVER PRIORY": ["DOVER PRIORY", "DVP", "PLT", "DVP"],
  "FAVERSHAM UP SIDINGS": ["FAVERSHAM", "FAV", null, "FAV"],
  "FAVERSHAM BK ROAD": ["FAVERSHAM", "FAV", "BK ROAD", "FAV"],
  "FAVERSHAM": ["FAVERSHAM", "FAV", null, "FAV"],
  "FOLKESTONE ETR": ["FOLKESTONE EAST", "FKE", null, "FKE"],
  "FOLKESTONE EAST TRAIN RD": ["FOLKESTONE EAST", "FKE", null, "FKE"],
  "FOLKESTONE EAST": ["FOLKESTONE EAST", "FKE", null, "FKE"],
  "GILLINGHAM E.M.U.D": ["GILLINGHAM", "GI", null, "GI"],
  "GILLINGHAM RECEPTION ROAD": ["GILLINGHAM", "GI", null, "GI"],
  "GILLINGHAM UP SDGS": ["GILLINGHAM", "GI", "UP SDGS", "GI"],
  "GILLINGHAM UP SIDINGS": ["GILLINGHAM", "GI", "UP SDGS", "GI"],
  "GILLINGHAM": ["GILLINGHAM", "GLM", null, "GLM"],
  // A train booked into one of the depot roads is destined GPD - Grove Park
  // depot. GPK is Grove Park the station, and only a service that terminates
  // there gets it (the books use both: SLADE GREEN 18+04 and 22+35 print GPD
  // for the depot, GROVE PARK 15+32 prints GPK for the station).
  "GROVE PARK C.S.D": ["GROVE PARK", "GP", "SD", "GPD"],
  "GROVE PARK DOWN CHS": ["GROVE PARK", "GPD", "DN", "GPD"],
  "GROVE PARK UP C.H.S": ["GROVE PARK", "GPU", "UP", "GPD"],
  "GROVE PARK UP HEADSHUNT": ["GROVE PARK", "GP", null, "GPD"],
  "GROVE PARK DPT CTRY ED EXT": ["GROVE PARK", "GP", null, "GPD"],
  "GROVE PARK DPT LNDN ED EXT": ["GROVE PARK", "GP", null, "GPD"],
  "GROVE PARK": ["GROVE PARK", "GP", null, "GPK"],
  "HASTINGS": ["HASTINGS", "HGS", null, "HGS"],
  "HASTINGS PARK SIDINGS": ["HASTINGS", "HGS", null, "HGS"],
  "HASTINGS SIGNAL 70": ["HASTINGS", "HGS", null, "HGS"],
  "ORPINGTON": ["ORPINGTON", "ORP", null, "ORP"],
  "ORPINGTON DOWN SDGS": ["ORPINGTON", "ORP", null, "ORP"],
  "SLADE GREEN T&R.S.M.D": ["SLADE GREEN", "SG", null, "SGR"],
  "SLADE GREEN UP C.H.S": ["SLADE GREEN", "SGU", "UPS", "SGR"],
  "SLADE GREEN DPT EAST HSHNT": ["SLADE GREEN", "SG", null, "SGR"],
  "SLADE GREEN": ["SLADE GREEN", "SGR", null, "SGR"],
  "STROOD": ["STROOD", "SOO", null, "SOO"],
  "STROOD SHUNT SIGNAL NK1630": ["STROOD", "SOO", null, "SOO"],
  "TONBRIDGE": ["TONBRIDGE", "TON", null, "TON"],
  "TONBRIDGE DM SIDING": ["TONBRIDGE", "TON", "DNM", "TON"],
  "TONBRIDGE JUB SDGS": ["TONBRIDGE", "TON", "JUB", "TON"],
  "TONBRIDGE SIGNAL AD160": ["TONBRIDGE", "TON", null, "TON"],
  "ST. LEONARDS W.M. C.S.D": ["WEST MARINA", "XSE", null, "XSE"],
  "ST. LEONARDS SHUNT NECK": ["WEST MARINA", "XSE", null, "XSE"],
  "VICTORIA GROSVENOR SHED": ["VICTORIA", "VIC", null, "VIC"],
  "VICTORIA": ["VICTORIA", "VIC", null, "VIC"],
  "RAMSGATE E.M.U.D": ["RAMSGATE", "RE", null, "RE"],
  "RM DEPOT RECEPTION WEST": ["RAMSGATE", "RE", null, "RE"],
  "RAMSGATE NEW SIDINGS": ["RAMSGATE", "RE", "NEW SIDINGS", "RE"],
  "RAMSGATE UP SIDING WEST": ["RAMSGATE", "RE", null, "RE"],
  "RAMSGATE SIGNAL EK4985": ["RAMSGATE", "RE", null, "RE"],
  "RAMSGATE SIGNAL EK5143": ["RAMSGATE", "RE", null, "RE"],
  "RAMSGATE SIGNAL EK5145": ["RAMSGATE", "RE", null, "RE"],
  "RAMSGATE": ["RAMSGATE", "RAM", null, "RAM"],
  "DARTFORD UP SIDINGS": ["DARTFORD", "DFD", null, "DFD"],
  "DARTFORD DOWN SIDINGS": ["DARTFORD", "DFD", null, "DFD"],
  "DARTFORD": ["DARTFORD", "DFD", null, "DFD"],
  "MAIDSTONE EAST": [null, "MDE", null, "MDE"],
  "TUNBRIDGE WELLS TURNBACK": [null, "TBW", null, "TBW"],
  "TUNBRIDGE WELLS": [null, "TBW", null, "TBW"],
  "SEVENOAKS C.H.S": [null, "SEV", null, "SEV"],
  "SEVENOAKS": [null, "SEV", null, "SEV"],
  "CANNON STREET": [null, "CST", null, "CST"],
  "CHARING CROSS": [null, "CHX", null, "CHX"],
  "LONDON BRIDGE": [null, "LBG", null, "LBG"],
  "LONDON BLACKFRIARS": [null, "BFR", null, "BFR"],
  "PLUMSTEAD C.H.S": [null, "PLU", null, "PLU"],
  "SIDCUP SIDING": ["SIDCUP", "SID", null, "SID"],
  "ASHFORD HITACHI DEPOT": ["ASHFORD", "AFK", null, "AFK"],
  "SEVINGTON LOOP": ["ASHFORD", "SVL", null, "SVL"],
  "BELLINGHAM SIDING": [null, "BGM", null, "BGM"],
  "ORE UP SIDING": [null, "ORE", null, "ORE"],
  "ORE": [null, "ORE", null, "ORE"],
  "SELHURST DEPOT": [null, "SEL", null, "SEL"],
  "MARGATE": [null, "MAR", null, "MAR"],
  "CANTERBURY WEST": [null, "CBW", null, "CBW"],
  "CANTERBURY WEST SHNT SG 1": [null, "CBW", null, "CBW"],
  "CANTERBURY WEST SHNT SG 25": [null, "CBW", null, "CBW"],
  "FOLKESTONE CENTRAL": [null, "FKC", null, "FKC"],
  "PADDOCK WOOD": [null, "PDW", null, "PDW"],
  "SHEERNESS-ON-SEA": [null, "SSS", null, "SSS"],
  "SITTINGBOURNE": [null, "SIT", null, "SIT"],
  "HERNE BAY": [null, "HNB", null, "HNB"],
  "GRAVESEND": [null, "GRV", null, "GRV"],
  "MAIDSTONE WEST": [null, "MDW", null, "MDW"],
  "MAIDSTONE WEST SIGNAL MS57": [null, "MDW", null, "MDW"],
  "DOVER SIGNAL YE 621": ["DOVER PRIORY", "DVP", null, "DVP"],
  "DOVER SIGNAL YE 623": ["DOVER PRIORY", "DVP", null, "DVP"],
  "FAVERSHAM SIGNAL EK4327": ["FAVERSHAM", "FAV", null, "FAV"],
  "FAVERSHAM SIGNAL EK4352": ["FAVERSHAM", "FAV", null, "FAV"],
};
const NON_BERTH_VISIT = new Set([
  "TUNBRIDGE WELLS TURNBACK", "ORE UP SIDING", "HASTINGS SIGNAL 70",
  "CANTERBURY WEST SHNT SG 1", "CANTERBURY WEST SHNT SG 25",
  "ST. LEONARDS SHUNT NECK", "MAIDSTONE WEST SIGNAL MS57",
  "STROOD SHUNT SIGNAL NK1630", "DOVER SIGNAL YE 621", "DOVER SIGNAL YE 623",
  "FAVERSHAM SIGNAL EK4327", "FAVERSHAM SIGNAL EK4352",
  "RAMSGATE SIGNAL EK4985", "RAMSGATE SIGNAL EK5143",
  "RAMSGATE SIGNAL EK5145", "SLADE GREEN DPT EAST HSHNT",
  "GROVE PARK UP HEADSHUNT", "GROVE PARK DPT CTRY ED EXT"]);
const SIDING_CLASS_RE = new RegExp(
  "SIDING|SDGS|SDG\\b|C\\.H\\.S|CHS\\b|C\\.S\\.D|CSD\\b|E\\.M\\.U\\.D|EMUD|" +
  "SHED|YARD|DEPOT|T&R|RECEPTION|WASHER|BTH SDGS|BK ROAD|ETR\\b|" +
  "CTRY ED EXT|NEW SIDINGS|UP SIDING");

/* ==== house sheet layout (ex xlsx glue) ==== */
  const MAIN_ORDER = ["ASHFORD", "DOVER PRIORY", "FAVERSHAM",
    "FOLKESTONE EAST", "GILLINGHAM", "GROVE PARK", "HASTINGS", "ORPINGTON",
    "SLADE GREEN", "STROOD", "TONBRIDGE", "VICTORIA", "WEST MARINA"];
  const HEADCODE_SECTIONS = new Set(["GILLINGHAM", "VICTORIA", "GROVE PARK"]);
  const GP_ROAD = { "GROVE PARK C.S.D": "SD", "GROVE PARK DOWN CHS": "DN",
    "GROVE PARK UP C.H.S": "UP", "GROVE PARK UP HEADSHUNT": "UP",
    "GROVE PARK DPT CTRY ED EXT": "SD" };
  const SIDING_NOTES = { "ASHFORD EAST BTH SDGS": "EAST SIDINGS",
    "ASHFORD UP SIDINGS": "UP SIDINGS", "SLADE GREEN UP C.H.S": "UPS",
    "TONBRIDGE DM SIDING": "DNM", "TONBRIDGE JUB SDGS": "JUB" };
  const END_STYLE = { "HASTINGS": ["TON END", "ORE END"],
    "WEST MARINA": ["HGS END", null],
    "FOLKESTONE EAST": ["AFK END", "DVP END"],
    "DOVER PRIORY": ["FKE END", "CBE END"] };
  const DAY_SHEET = { M: "MON", T: "TUE", W: "WED", TH: "THU", F: "FRI" };
  const METRO_ORDER = ["CANNON STREET", "CHARING CROSS", "DARTFORD",
    "GILLINGHAM", "GROVE PARK", "ORPINGTON", "PLUMSTEAD", "RAMSGATE",
    "SLADE GREEN", "TONBRIDGE", "VICTORIA"];
  const HS_ORDER = ["ASHFORD", "FAVERSHAM", "RAMSGATE"];

/* ==== Genius location knowledge (ex GENIUS) ==== */
  // ---- locations ----
  const CODE2NAME = {
    ASHFDNS: "Ashford Down Sidings", ASHFUPS: "Ashford Up Sidings",
    ASHFEBS: "Ashford East Bth Sdgs", ASHFDYW: "Ashford Down Washer Rd",
    ASHFDY: "Ashford Down Yard", ASHFKY: "Ashford",
    FLKSETR: "Folkestone ETR", VICTGCS: "Victoria Grosvenor Shed",
    VICTRIE: "Victoria", GLNGDEP: "Gillingham E.M.U.D",
    GLNGHMK: "Gillingham", GLNGMUS: "Gillingham Up Sdgs",
    RAMSGTD: "Ramsgate E.M.U.D", RAMSGTE: "Ramsgate",
    RAMSNEW: "Ramsgate New Sidings", DOVERP: "Dover Priory",
    DOVERPS: "Dover Priory Sidings", FAVRUPS: "Faversham Up Sidings",
    FAVRBRD: "Faversham BK Road", HASTING: "Hastings",
    HASTPSD: "Hastings Park Sidings", STLNWCS: "St. Leonards W.M. C.S.D.",
    TONBDMS: "Tonbridge DM Siding", TONBPMY: "Tonbridge Jub Sdgs",
    TONBDG: "Tonbridge", GRVPCSD: "Grove Park C.S.D",
    GRVPKDS: "Grove Park Down CHS", GRVPKUS: "Grove Park Up C.H.S",
    // The depot extensions and headshunts: the CSV export truncates their
    // names to 16 characters ("Grove Park Dpt C", "Slade Green Dpt"), which
    // matches nothing, so name them here as the berth tables spell them.
    GRVPDCE: "Grove Park Dpt Ctry Ed Ext",
    GRVPDLE: "Grove Park Dpt Lndn Ed Ext",
    GRVPUHS: "Grove Park Up Headshunt",
    SLADGEH: "Slade Green Dpt East Hshnt",
    SLADEGD: "Slade Green T&R.S.M.D", SLADGUS: "Slade Green Up C.H.S",
    DARTFUS: "Dartford Up Sidings", DARTFDS: "Dartford Down Sidings",
    DARTFD: "Dartford", PLMSTCS: "Plumstead C.H.S", ORPNGTN: "Orpington",
    ORPNDSG: "Orpington Down Sdgs", BELNGMS: "Bellingham Siding",
    CANONST: "Cannon Street", SIDCUPS: "Sidcup Siding", STROOD: "Strood",
    /* Without this the export's own truncated spelling stood as the section
       name, so METRO_ORDER's "CHARING CROSS" matched nothing and the
       location came out as a LONDON CHARING X tab ranked last, after every
       named one. The destination side always worked - NAME_CODE carries the
       truncation - which is why it went unnoticed. */
    CHRX: "Charing Cross",
    /* Genius spells Ore's siding plural and West Marina's neck without
       the stop; BERTH_SHEETS and NON_BERTH_VISIT are keyed the other
       way, so without these two every Genius build says "Ore Up Sidings
       is not in the section list" and the neck's visit guard never
       fires. */
    OREESDG: "Ore Up Siding",
    STLNSHN: "St. Leonards Shunt Neck", STLNCET: "St Leonards CET",
    FLKSTNE: "Folkestone East",
  };
  // Working locations that belong to a section without being berths - the
  // walk stays inside the section through them, so the entry is timed off
  // them (West Marina's times come from the shunter neck, per the hand
  // rule set).
  const GROUP_EXTRA = {
    "WEST MARINA": new Set(["STLNSHN", "STLNCET"]),
    // Folkestone East times come from the Train Roads, not the station
  };
  // Sidings, depots and sheds only. Stations are working locations, not
  // berths (the Maidstone West rule) - they qualify only as the overnight
  // endpoint of a diagram, which secOf handles separately.
  const STABLE_CODES = new Set(["ASHFDNS", "ASHFUPS", "ASHFEBS", "ASHFDYW",
    "ASHFDY", "VICTGCS", "GLNGDEP", "GLNGMUS", "RAMSGTD", "RAMSNEW",
    "DOVERPS", "FAVRUPS", "FAVRBRD", "HASTPSD", "STLNWCS", "TONBDMS",
    "TONBPMY", "GRVPCSD", "GRVPKDS", "GRVPKUS", "GRVPDCE", "GRVPDLE",
    "GRVPUHS", "SLADGEH", "SLADEGD", "SLADGUS",
    "DARTFUS", "DARTFDS", "PLMSTCS", "ORPNDSG", "BELNGMS", "SIDCUPS",
    "FLKSETR"]);
  // corrections learned from the hand-built sheets: these beat whatever
  // the tables or the resolver come back with
  const NAME_CODE = { "DARTFORD UP SIDINGS": "DFU", "GILLINGHAM UP SDGS": "GIU",
    "BELLINGHAM SIDING": "BGM", "PLUMSTEAD C.H.S": "PLU",
    "FOLKESTONE EAST": "FKE", "FOLKESTONE ETR": "FKE", "MINSTER THANET": "MSR",
    "ST LEONARDS SHUNT NECK": "XSE", "ST LEONARDS CET": "XSE",
    /* Charing Cross truncated. The reports abbreviate a long terminal name
       ("London Blackfr's", "London Cannon St"), and any form the resolver
       cannot place falls back to the first three letters - which for anything
       beginning "London" is the useless LON. Note what is NOT here: bare
       CHARING is Charing in Kent, CHG, a different station on the Maidstone
       East line, so it must never be swept into this. */
    "LONDON CHARING CROSS": "CHX", "LONDON CHARING X": "CHX",
    "LONDON CHARING C": "CHX", "LONDON CHARING CR": "CHX",
    "LONDON CHARING CRS": "CHX", "LONDON CHRING X": "CHX",
    "CHARING CROSS": "CHX", "CHARING X": "CHX", "CHARING CRS": "CHX",
    "CHG CROSS": "CHX", "CHRG CROSS": "CHX" };
  const FIX_CODE = { GLU: "GIU" };
  /* Formations the reports cannot place. Position says where a unit sits in
     its own diagram's formation, not which way that formation is facing, and
     nothing in either export says which way round it was left standing:
     Grove Park 05+19 (SG809/SG810) and 05+48 (SG813/SG814) are identical in
     every field of both exports and want opposite orders. Where the books
     disagree with the section's rule, name the diagrams here and the order is
     taken verbatim.

     Key: the section, optionally a space and the entry's own time, then "|"
     and the diagram numbers as the sheet prints them, sorted. The timed form
     is looked up first. Give a time only when the same formation reads one
     way earlier in the day and the other way later - GT101/GT102 leave
     Ashford 102 first at 05 05 and 101 first at 15+43, and GT127/GT128 leave
     Victoria 128 first at 05+50 and 127 first at 17 14. Everything else
     holds all day and is better named without a time, so it still applies
     when the timetable moves the working by a few minutes.

     The mainline entries are taken from the hand-written book for 12/08. The
     Metro ones are corrections marked on a book this tool produced for 10/08
     and then put right by hand: six formations, each moved the same way
     everywhere it appears, which is what an orientation correction looks
     like. Metro diagram numbers (2xx, 4xx) do not collide with the mainline
     ones, so the shared section names are safe. */
  /* ---- turning round in the platform ----
     A unit that comes off its berth, runs into the platform and then leaves
     is standing the other way up by the time it goes: it backed in one end
     and pulls out the other. The Summary's Position is the order it left the
     BERTH in, so for those workings the sheet has to print the formation
     reversed - which is what the depot means by "the position from the
     platform is the right one".

     Whether it turns depends on which side of the station it arrives from
     and which side it leaves towards. Same side, it reversed; opposite
     sides, it ran straight through and the order stands.

     The sides below are read off the workings themselves rather than a track
     plan, and they account for every Ramsgate formation anybody has checked:
     the five that were pinned by hand off the 12/08 book, the four reported
     wrong off the 21/08 book, and 054/055/056, which comes out of the same
     New Sidings as 052/053 but leaves towards Minster instead of Margate and
     is right the way it already prints. A location that is not named here
     leaves the order alone and puts a line on the review list, because
     guessing which way a train faces is the one thing this must not do. */
  const PLATFORM_TURN = {
    RAMSGATE: {
      platform: "RAMSGTE",
      side: {
        // towards Margate
        MARGATE: "W", RAMSDRW: "W", RAM4985: "W", RAMSNEW: "W", RAMSUSW: "W",
        // towards Minster, and everything beyond it
        MINSTER: "E", DOVERP: "E", RAM5143: "E",
      },
    },
  };

  const ORDER_FIX = {
    "ASHFORD|004,905": ["004", "905"],
    "ASHFORD|114,115": ["115", "114"],
    "ASHFORD|301,901,902": ["901", "902", "301"],
    "ASHFORD 15+43|101,102": ["101", "102"],
    "DOVER PRIORY|013,014": ["014", "013"],
    "FAVERSHAM|019,020": ["020", "019"],
    "GROVE PARK|021,022": ["022", "021"],
    "GROVE PARK|118,119": ["118", "119"],
    /* 301 is last at Ashford and first at Grove Park, so this cannot be a bare
       key. Untimed on purpose: the book shows 15+54 on every sheet, but a
       Friday minute change would silently defeat a timed pin. Only the Genius
       summary carries a Position per stint, which is the one reason the
       unpinned Grove Park entry came out right there; an Integrale export has
       one start-of-day Position per diagram and sorted the PM entry on morning
       Positions, putting the 3-car at the rear. */
    "GROVE PARK|301,901,902": ["301", "902", "901"],
    /* Section-scoped, not bare: 805/806 read ascending at Slade Green 18+04
       and descending here, and both sections list lowest Position first, so
       posAsc cannot express it. A timed key is no use either - the book times
       this off the headshunt departure (05+25) and the tool off the move out
       of the siding (05+14), so a key written from the book's time never
       fires. Caveat: the key is built before attaching units are filtered, so
       if 5S07 ever runs with a third unit this stops matching. */
    "GROVE PARK|805,806": ["806", "805"],
    "HASTINGS|029,030": ["030", "029"],
    /* Ramsgate's five backwards formations used to be pinned here, one key
       per formation. They are gone: PLATFORM_TURN above derives all five,
       because every one of them is a working that backs into the platform
       and pulls out the same end it came in. Pinning them by formation was
       always brittle - the key names an exact set of diagrams, so when
       043/044 ran as a pair on 21/08 instead of the trio 043/044/910 the pin
       stopped matching and the sheet went back to printing it the wrong way
       round. That is the fault this rule replaces. */
    /* No section: this formation reads the same way wherever it turns up.
       RM046/RM047/RM913 print 913 first in the 12/08 Ramsgate book at 07 02
       and again in the mainline book off Grove Park at 16+13 - the same three
       units, the same way round, hours apart.

       This line is kept for GROVE PARK only. The Ramsgate half is now derived
       by PLATFORM_TURN, so the pin is dormant there: with the pin removed
       12/08 Ramsgate still prints 913 first, and with PLATFORM_TURN removed
       as well it flips to 046 first. Grove Park is the opposite - the rule
       does not reach it, and on 12/08 the Position numbers give the right
       order unaided, so the pin is dormant there too. It earns its place on
       the later day a tester found Grove Park the other way round, when the
       Position field had moved under it.

       Do not narrow this to a GROVE PARK key to say so. The lookup warns when
       a formation has an order recorded somewhere and no key fires here, so a
       section key would put a false review note on every Ramsgate appearance
       of the trio - about an order the tool now gets right by itself.

       Only use a bare key where the order really is the same everywhere:
       RM043/RM044 read one way at Grove Park and the other at West Marina,
       and would be wrong pinned. */
    "046,047,913": ["913", "047", "046"],
    "VICTORIA 17 14|127,128": ["127", "128"],
    // Metro, from the marked-up 10/08 book
    "BELLINGHAM SIDING|461,462": ["461", "462"],
    "CANNON STREET|403,404": ["403", "404"],
    "CANNON STREET|405,406": ["405", "406"],
    "GILLINGHAM|201,422": ["422", "201"],
    "GROVE PARK|204,440,441": ["204", "440", "441"],
    "SLADE GREEN|201,422": ["422", "201"],
    "SLADE GREEN|204,440,441": ["204", "440", "441"],
    "SLADE GREEN|403,404": ["403", "404"],
    "SLADE GREEN|405,406": ["405", "406"],
    "SLADE GREEN|461,462": ["461", "462"],
    "SLADE GREEN|465,466": ["465", "466"],
  };

  // ---- fleet profiles (the weekend PROFILES, verbatim strings) ----
  // posAsc: sections that list units LOWEST Summary Position first. The rest
  // list highest first.
  //
  // The sheets list a formation in physical order, and a unit's Position is
  // fixed to its diagram for the whole day - so which end of the formation
  // carries Position 1 depends on which way it is facing, and that turns out
  // to be a property of the section. The same pair reads ascending at Dover
  // Priory and descending at Ashford and Victoria. This list is what the
  // 10/08 books say, section by section; nothing in the reports predicts it,
  // so it is house knowledge like the berth tables.
  //
  // Checked against the real book for 12/08: Folkestone East, Grove Park,
  // Slade Green, Hastings, Dover Priory and Gillingham list lowest first;
  // Victoria, West Marina, Orpington and Ashford list highest first.
  // The metro and High Speed books have not been checked; they list highest
  // Position first throughout.
  //
  // roadPosAsc: individual berthing roads that face the other way to the rest
  // of their section, and so read the other way round. A road named here
  // beats its section's rule. Ashford's Up Sidings are the case the 12/08
  // book proves: every departure off the Down Sidings lists highest Position
  // first, and all three off the Up Sidings list lowest first.
  const PROFILES_G = [
    { bucket: "main", fleets: { "375/6": "4 375", "375/9": "4 375-9",
        "375/3": "3 375", "377/5": "4 377", "376/0": "5 376" },
      /* Ramsgate IS on the posAsc list below, and has to stay there. Six of
         its coupled formations read lowest Position first and five read
         highest first, so turning the whole section round swapped which five
         came out wrong rather than fixing anything - that was tried and
         measured against the real 12/08 Ramsgate book. The five are named in
         ORDER_FIX instead, where the same tester's mark-up put them.
         This note used to say the opposite, and it was wrong: anyone who
         "corrected" the code to match it would quietly reverse the six
         formations that are already right. */
      posAsc: new Set(["DOVER PRIORY", "FAVERSHAM", "FOLKESTONE EAST",
        "GILLINGHAM", "GROVE PARK", "HASTINGS", "RAMSGATE", "SLADE GREEN"]),
      roadPosAsc: new Map([["ASHFORD UP SIDINGS", true]]),
      // Tonbridge and Faversham look like first-departure sections in the
      // book - it times them off the berth, not the platform a minute later
      // - but firstDep is the wrong tool: it takes the first move of the
      // whole stint, and RM302 comes off the Back Road at 05:29 before the
      // Up Sidings departure at 05:36 that the book actually uses. Adding
      // them here costs more entries than it wins.
      firstDep: new Set(["GROVE PARK", "SLADE GREEN"]),
      ecsOnlyOk: new Set(["WEST MARINA", "GROVE PARK", "SLADE GREEN"]) },
    { bucket: "metro", fleets: { "465/9": "4 465", "465/0": "4 465",
        "466/0": "2 466", "707/0": "5 707" },
      // metro house rule: every entry is timed off the first time the unit
      // moves, so an empty run out of the sidings is the time on the sheet.
      // A platform starter's first move IS its platform departure, so those
      // keep the platform time.
      firstDepAll: true,
      posAsc: new Set(), roadPosAsc: new Map(),
      firstDep: new Set(["GROVE PARK", "SLADE GREEN"]),
      ecsOnlyOk: new Set(["GROVE PARK", "SLADE GREEN"]) },
    { bucket: "hs", fleets: { "395/0": "6 395" },
      /* The High Speed allocation sheet is timed off the first time the unit
         moves, the way the Metro one is: their own 18/08 sheet has AZ601 at
         04+19 where the platform departure is 05+03. This is the reports
         side only - see the weekend derivation below. */
      firstDepAll: true,
      posAsc: new Set(), roadPosAsc: new Map(),
      firstDep: new Set(), ecsOnlyOk: new Set() },
  ];
  // A home berthing siding splits the diagram whenever the identity
  // changes there - the books list every re-departure off those roads,
  // even after a 40-minute sit (the manual's 14+41 / 15+43 / 16 27
  // Ashford rows prove it). Only the SHUNT SPURS - places that host
  // brief working calls all day and are never listed as re-departures -
  // need a stay of berthing length before they split.

  const MINOR_SPUR = new Set(["HASTPSD", "BELNGMS", "STLNCET", "GLNGMUS"]);
  /* Sections that share one berthing area. A unit still on a berth at 20 00
     has ended its day there whatever a late working does with it afterwards -
     but only while it stays in the area: a unit shut in the St Leonards shed
     and shunted out to Hastings for the night is still a shed unit, and the
     12/08 book prints XSE for all twelve of them. A late run OUT of the area
     is the unit going home, and the book follows it: GT105/GT106 off Ashford
     East to the Folkestone Train Roads print FKE, and RM301 off Ramsgate to
     Gillingham prints GI. */
  const BERTH_AREAS = [new Set(["WEST MARINA", "HASTINGS"])];
  const END_MARKERS_GENIUS = {
    "DOVER PRIORY": {
      fke: "FKE END", cbe: "CBE END",
      fkeLeads: new Set(["CHX", "CST", "TON", "AFK"]),
      cbeLeads: new Set(["VIC", "FAV", "SIT", "RTR", "SOO", "GLM"]),
      cbeVia: "FAVERSHAM",
    },
    // At Folkestone East the two ends are named for Ashford and Dover -
    // same idea as Dover Priory's pairing, per the hand rule set
    "FOLKESTONE EAST": {
      fke: "AFK END", cbe: "DVP END",
      fkeLeads: new Set(["AFK", "CHX", "CST", "TON", "MDE", "LBG", "VIC", "STP",
                         "FKC", "FKE"]),
      cbeLeads: new Set(["DVP", "DEA", "SDW", "RAM", "MAR"]),
      cbeVia: "DOVER PRIORY",
    },
  };

  /* ==== the same destination by two routes ================================
     Dover and Ramsgate both reach Victoria two ways, and the route decides
     two things the sheet has to get right: what the destination cell says,
     and - at Dover Priory - which end of the train leads. Neither export
     lists the intermediate calls on those legs, so the route has to be read
     off the headcode, which carries it: a 2C runs via Ashford and the
     Maidstone East line, everything else goes round by Faversham.

     Read off the SUN 16/08 prints, where the two routes are plainly
     different journeys - Dover to Victoria is 88 miles in 116 minutes as
     2C22 and 78 miles in 148 as 2K64/2K66/2K70, and Ramsgate's 2C20 / 2C24 /
     2C28 / 2C32 sit against 1P20 / 1P22 / 1P26 / 1P30 the same way. A 2C
     leaves Dover towards Folkestone, so the Folkestone end leads; the
     Faversham services leave the other way and keep the CBE end in front,
     which is what the plain destination rules above already say.

     `via` is what the notes column adds - "Via AFK", beside the end
     marker. It does NOT go against the time: column A reads "HH MM DDD" in
     every real book and never more, the longest value in any of them being
     nine characters, so "08 28 VIC Via AFK" widened the column for the
     whole page. `lead` names
     which end of END_MARKERS leads, and beats the destination sets when it
     is given. A section with no rule here behaves exactly as before.     */
  const ROUTE_BY_HC = {
    "DOVER PRIORY": [{ dest: "VIC", hc: /^2C/, via: "AFK", lead: "fke" }],
    "RAMSGATE": [{ dest: "VIC", hc: /^2C/, via: "AFK" }],
  };
  function routeRule(sec, dest, hc) {
    const list = ROUTE_BY_HC[sec];
    if (!list || !dest || !hc) return null;
    for (const r of list)
      if (r.dest === dest && r.hc.test(hc)) return r;
    return null;
  }

/* ==== weekend prints knowledge (ex SheetsEngine) ==== */
const DEST_CODE = {
 "Vic (E)":"VIC","CX":"CHX","C St":"CST","Lndon BrE":"LBG",
 "Maid E":"MDE","Maid W":"MDW","Tonbridge":"TON","TunbdgWls":"TBW",
 "Dover P":"DVP","Ram":"RAM","Fav":"FAV","Mgate":"MAR",
 "Hastings":"HGS","Sheer":"SSS","Strood":"SOO","Gill":"GLM",
 "Hayes":"HYS","Hither Gn":"HGR","Grove Par":"GRP","Gend":"GRV",
 "Orp":"ORP","Dart":"DFD","Blckhth":"BKH","S Gn":"SGR",
 "Ashford I":"AFK","StPancInt":"STP","Sevenoaks":"SEV",
 "Hast Pk S":"HGS","St L Shed":"XSE","Cantrbry W":"CBW",
 "Sitt":"SIT","Roch":"RTR","New Cross":"NWX","Lew":"LEW",
 "Barnhst":"BNH","Bexlyhth":"BXH","Sidcup":"SID","Crayfd":"CRY",
 "Erith":"ERH","Plumstd":"PLU","Woolwich A":"WWA","AbbeyWd":"ABW",
 "Deal":"DEA","Sndwch":"SDW","Dover W":"DVP","CantrbryW":"CBW",
 "Swan":"SAY",
 "S Gn Dep":"SGR","S Gn U Sd":"SGR","SldGrDEHs":"SGR",
 "G Pk Dep":"GRP","G Pk DnSd":"GRP","G Pk UpSd":"GRP",
 "Gill Dep":"GI","Gill US":"GLU","Ram Depot":"RAM",
 "RamsNewSd":"RAM","RMUSW":"RAM","Ton DMS":"TON","TonbJubS":"TON",
 "Orp Dn Sd":"ORP","Dart USd":"DFD","Dart DSd":"DFD",
 "Ashfrd DS":"AFK","Ash Up Sd":"AFU","Ashfd EBS":"AFE","Fav Up Sd":"FAV",
 "Fav Bk Rd":"FAV","Dover PSd":"DVP",
};
const BERTH_CODE = {
 "Ashfrd DS":"AFK","Ashfd EBS":"AFE","Ash Up Sd":"AFU","Ashford I":"AFK",
 "Ram":"RE","Ram Depot":"RE","RMUSW":"RE","RamsNewSd":"RE",
 "RM EK4981":"RE","RM EK4985":"RE","RM EK5143":"RE","RM EK5145":"RE",
 "Vic (E)":"VIC","VictGroSh":"VIC","CX":"CHX","Lndon BrE":"LBG",
 "Dover P":"DVP","Dover PSd":"DVP","Dover621":"DVP","Dover623":"DVP",
 "Fav":"FAV","Fav Bk Rd":"FAV","Fav Up Sd":"FAV","FV EK4327":"FAV",
 "Gill":"GLM","Gill Dep":"GI","Gill US":"GLU",
 "Hastings":"HGS","Hast Pk S":"HGS","St L Shed":"XSE",
 "Tonbridge":"TON","Ton DMS":"TON","TonbJubS":"TON",
 "G Pk Dep":"GP","G Pk DnSd":"GPD","G Pk UpSd":"GPU",
 "GrPkDCtEE":"GPD","Gvpuphs":"GPU","Grove Par":"GP",
 "S Gn Dep":"SG","S Gn U Sd":"SGU","SldGrDEHs":"SG","S Gn":"SG",
 "Orp":"ORP","Orp Dn Sd":"ORP","C St":"CST",
 "Maid W":"MDW","Dart":"DFD","Dart USd":"DFD","Dart DSd":"DFD",
 "Gend":"GRV","Sevenoaks":"SEV","Plum Sdg":"PLU","Bell Sd":"BGM",
};
const NOTE_FROM_BERTH = {
 "Ton DMS":"DNM","TonbJubS":"JUB","Hast Pk S":"PARK",
 "G Pk DnSd":"DN","G Pk UpSd":"UP","G Pk Dep":"SD",
 "S Gn U Sd":"UPS","S Gn Dep":"DN","SldGrDEHs":"DN",
 "Dart USd":"UPS","Dart DSd":"DN",
 "Ash Up Sd":"Up Sidings","Ashfd EBS":"East Sidings",
};
/* Sections with a station platform the unit may call at on its way out. The
   entry is timed off the platform when the unit runs through it, and off the
   first movement when it does not. */
const PLATFORM = {"ASHFORD": "Ashford I"};
const BASE_STABLING = new Set([
 "Ashfrd DS","Ashfd EBS","Ash Up Sd","Dover PSd","Dover621","Dover623",
 "Fav Bk Rd","Fav Up Sd","FV EK4327","Gill Dep","Gill US",
 "G Pk Dep","G Pk DnSd","G Pk UpSd","GrPkDCtEE","Gvpuphs",
 "Hast Pk S","Orp Dn Sd","Ram Depot","RMUSW","RamsNewSd",
 "RM EK4981","RM EK4985","RM EK5143","RM EK5145",
 "S Gn Dep","S Gn U Sd","SldGrDEHs","Ton DMS","TonbJubS","Tonbdg160",
 "VictGroSh","St L Shed","Dart USd","Dart DSd","Plum Sdg","Bell Sd",
]);
// Maidstone West is a station, not a siding: a unit turning round there is
// working, not berthed. Stations do not belong in BASE_STABLING.
const TRANSIT = new Set(["AshfDYWRd","St L ShNk","RM DRW","New Cross"]);
/* ---- station reference (name|CRS|1 = on the Southeastern roster) ----------
   Consulted only when a location is not in the curated tables above. Every
   match is written to the report so it can be checked and, if right, promoted
   into DEST_CODE / BERTH_CODE. Sources: National Rail 3-alpha codes,
   cross-checked against Southeastern's published station list.            */
const STATION_TABLE = "Abbey Wood|ABW|1\nActon Central|ACC\nActon Main Line|AML\nAdisham|ADM|1\nAlbany Park|AYP|1\nAldrington|AGT\nAlexandra Palace|AAP\nAlthorne|ALN\nAnerley|ANZ\nAppledore (Kent)|APD|1\nAshford International|AFK|1\nAshtead|AHD\nAshurst Kent|AHS|1\nAylesford|AYL|1\nAylesham|AYH|1\nBalcombe|BAB\nBalham|BAL\nBanstead|BAD\nBarking|BKG\nBarking Riverside|BGV\nBarming|BMG|1\nBarnehurst|BNH|1\nBarnes|BNS\nBarnes Bridge|BNI\nBasildon|BSO\nBat & Ball|BBL|1\nBattersea Park|BAK\nBattle|BAT|1\nBattlesbridge|BLB|1\nBearsted|BSD|1\nBeckenham Hill|BEC|1\nBeckenham Junction|BKJ|1\nBekesbourne|BKS|1\nBellingham|BGM|1\nBelmont|BLM\nBeltring|BEG|1\nBelvedere|BVD|1\nBenfleet|BEF\nBerrylands|BRS\nBerwick (Sussex)|BRK\nBetchworth|BTO\nBethnal Green|BET\nBexhill|BEX\nBexley|BXY|1\nBexleyheath|BXH|1\nBickley|BKL|1\nBillericay|BIC\nBirchington-On-Sea|BCH|1\nBirkbeck|BIK\nBishopstone (Sussex)|BIP\nBlackheath|BKH|1\nBlackhorse Road|BHO\nBond Street|BDS\nBookham|BKA\nBorough Green & Wrotham|BRG|1\nBowes Park|BOP\nBox Hill & Westhumble|BXW\nBrent Cross West|BCZ\nBrentford|BFD\nBrentwood|BRE\nBricket Wood|BWO\nBrighton|BTN\nBrimsdown|BMD\nBrixton|BRX|1\nBroadstairs|BSR|1\nBrockley|BCY\nBromley North|BMN|1\nBromley South|BMS|1\nBrondesbury|BSY\nBrondesbury Park|BSP\nBruce Grove|BCV\nBurgess Hill|BUG\nBurnham-On-Crouch|BUU\nBush Hill Park|BHK\nBushey|BSH\nBuxted|BXD\nCaledonian Road & Barnsbury|CIR\nCambridge Heath|CBH\nCamden Road|CMD\nCanada Water|ZCW\nCanary Wharf|CWX\nCanonbury|CNN\nCanterbury East|CBE|1\nCanterbury West|CBW|1\nCarpenders Park|CPK\nCarshalton|CSH\nCarshalton Beeches|CSB\nCastle Bar Park|CBP\nCaterham|CAT\nCatford|CTF|1\nCatford Bridge|CFB|1\nChadwell Heath|CTH\nChafford Hundred|CFH\nChalkwell|CHW\nCharing|CHG|1\nCharlton|CTN|1\nChartham|CRT|1\nChatham|CTM|1\nCheam|CHE\nChelsfield|CLD|1\nCheshunt|CHN\nChessington North|CSN\nChessington South|CSS\nChestfield & Swalecliffe|CSW|1\nChilham|CIL|1\nChingford|CHI\nChipstead|CHP\nChislehurst|CIT|1\nChiswick|CHK\nChrists Hospital|CHH\nCity Thameslink|CTK\nClapham High Street|CLP\nClapham Junction|CLJ\nClapton|CPT\nClaygate|CLG\nClock House|CLK|1\nCobham & Stoke Dabernon|CSD\nCollington|CLL\nCooden Beach|COB\nCooksbridge|CBR\nCoulsdon South|CDS\nCoulsdon Town|CDN\nCowden|CWN\nCrawley|CRW\nCrayford|CRY|1\nCrews Hill|CWH\nCricklewood|CRI\nCrofton Park|CFT|1\nCrouch Hill|CRH\nCrowborough|COH\nCrowhurst|CWU|1\nCrystal Palace|CYP\nCuffley|CUF\nCustom House|CUS\nCuxton|CUX|1\nDagenham Dock|DDK\nDalston Junction|DLJ\nDalston Kingsland|DLK\nDartford|DFD|1\nDeal|DEA|1\nDenmark Hill|DMK|1\nDeptford|DEP|1\nDoleham|DLH|1\nDorking|DKG\nDorking Deepdene|DPD\nDorking West|DKT\nDormans|DMS\nDover Priory|DVP|1\nDrayton Green|DRG\nDrayton Park|DYP\nDumpton Park|DMP|1\nDunton Green|DNG|1\nEaling Broadway|EAL\nEarlsfield|EAD\nEarlswood (Surrey)|ELD\nEast Croydon|ECR\nEast Dulwich|EDW\nEast Farleigh|EFL|1\nEast Grinstead|EGR\nEast Malling|EML|1\nEast Tilbury|ETL\nEast Worthing|EWR\nEastbourne|EBN\nEbbsfleet International|EBD|1\nEden Park|EDN|1\nEdenbridge|EBR\nEdenbridge Town|EBT\nEdmonton Green|EDR\nElephant & Castle|EPH|1\nElmers End|ELE|1\nElmstead Woods|ESD|1\nElstree & Borehamwood|ELS\nEltham|ELW|1\nEmerson Park|EMP\nEnfield Chase|ENC\nEnfield Lock|ENL\nEnfield Town|ENF\nEpsom|EPS\nEpsom Downs|EPD\nEridge|ERI\nErith|ERH|1\nEsher|ESH\nEssex Road|EXR\nEtchingham|ETC|1\nEwell East|EWE\nEwell West|EWW\nEynsford|EYN|1\nFalconwood|FCN|1\nFalmer|FMR\nFarningham Road|FNR|1\nFarringdon|ZFD\nFaversham|FAV|1\nFaygate|FGT\nFinchley Road & Frognal|FNY\nFinsbury Park|FPK\nFishersgate|FSG\nFolkestone Central|FKC|1\nFolkestone West|FKW|1\nForest Gate|FOG\nForest Hill|FOH\nFrant|FRT|1\nFulwell|FLW\nGarston|GSN\nGatwick Airport|GTW\nGidea Park|GDP\nGillingham (Kent)|GLM|1\nGipsy Hill|GIP\nGlynde|GLY\nGodstone|GDN\nGoodmayes|GMY\nGordon Hill|GDH\nGospel Oak|GPO\nGrange Park|GPK\nGravesend|GRV|1\nGrays|GRY\nGreenford|GFD\nGreenhithe for Bluewater|GNH|1\nGreenwich|GNW|1\nGrove Park|GRP|1\nGunnersbury|GUN\nHackbridge|HCB\nHackney Central|HKC\nHackney Downs|HAC\nHackney Wick|HKW\nHadley Wood|HDW\nHaggerston|HGG\nHalling|HAI|1\nHam Street|HMT|1\nHampden Park|HMD\nHampstead Heath|HDH\nHampton|HMP\nHampton Court|HMC\nHampton Wick|HMW\nHanwell|HAN\nHarlesden|HDN\nHarold Wood|HRO\nHarrietsham|HRM|1\nHarringay|HGY\nHarringay Green Lanes|HRY\nHarrow & Wealdstone|HRW\nHarrow-on-the-Hill|HOH\nHassocks|HSK\nHastings|HGS|1\nHatch End|HTE\nHaydons Road|HYR\nHayes (Kent)|HYS|1\nHaywards Heath|HHE\nHeadcorn|HCN|1\nHeadstone Lane|HDL\nHendon|HEN\nHerne Bay|HNB|1\nHerne Hill|HNH|1\nHersham|HER\nHever|HEV\nHigh Brooms|HIB|1\nHigham|HGM|1\nHighams Park|HIP|1\nHighbury & Islington|HHY\nHildenborough|HLB|1\nHinchley Wood|HYW\nHither Green|HGR|1\nHockley|HOC\nHollingbourne|HBN|1\nHolmwood|HLM\nHomerton|HMN\nHonor Oak Park|HPA\nHorley|HOR\nHornsey|HRN\nHorsham|HRH\nHounslow|HOU\nHove|HOV\nHow Wood|HWW\nHoxton|HOX\nHurst Green|HUR\nIfield|IFI\nIlford|IFD\nImperial Wharf|IMW\nIngatestone|INT\nIsleworth|ISL\nKearsney|KSN|1\nKemsing|KMS|1\nKemsley|KML|1\nKenley|KLY\nKensal Green|KNL\nKensal Rise|KNR\nKensington Olympia|KPA\nKent House|KTH|1\nKentish Town|KTN\nKentish Town West|KTW\nKenton|KNT\nKew Bridge|KWB\nKew Gardens|KWG\nKidbrooke|KDB|1\nKilburn High Road|KBN\nKingston|KNG\nKingswood|KND\nKnockholt|KCK|1\nLadywell|LAD|1\nLaindon|LAI\nLancing|LAC\nLea Bridge|LEB\nLeatherhead|LHD\nLee|LEE|1\nLeigh (Kent)|LIH\nLeigh-on-Sea|LES\nLenham|LEN|1\nLewes|LWS\nLewisham|LEW|1\nLeyton Midland Road|LEM\nLeytonstone High Road|LER\nLimehouse|LHS\nLingfield|LFD\nLittlehaven|LVN\nLondon Blackfriars|BFR|1\nLondon Bridge|LBG|1\nLondon Cannon Street|CST|1\nLondon Charing Cross|CHX|1\nLondon Euston|EUS\nLondon Fenchurch Street|FST\nLondon Fields|LOF\nLondon Kings Cross|KGX\nLondon Liverpool Street|LST\nLondon Marylebone|MYB\nLondon Paddington|PAD\nLondon Road (Brighton)|LRB\nLondon St Pancras International|STP|1\nLondon Victoria|VIC|1\nLondon Waterloo|WAT|1\nLondon Waterloo East|WAE|1\nLongfield|LGF|1\nLoughborough Junction|LGJ|1\nLower Sydenham|LSY|1\nMaidstone Barracks|MDB|1\nMaidstone East|MDE|1\nMaidstone West|MDW|1\nMalden Manor|MAL\nManor Park|MNP\nMarden|MRN|1\nMargate|MAR|1\nMartin Mill|MTM|1\nMaryland|MYL\nMaze Hill|MZH|1\nMeopham|MEP|1\nMeridian Water|MRW\nMerstham|MHM\nMill Hill Broadway|MIL\nMinster|MSR|1\nMitcham Eastfields|MTC\nMitcham Junction|MIJ\nMoorgate|MOG\nMorden South|MDS\nMortlake|MTL\nMotspur Park|MOT\nMottingham|MTG|1\nMoulsecoomb|MCB\nNew Barnet|NBA\nNew Beckenham|NBC|1\nNew Cross|NWX|1\nNew Cross Gate|NXG|1\nNew Eltham|NEH|1\nNew Hythe|NHE|1\nNew Malden|NEM\nNew Southgate|NSG\nNewhaven Harbour|NVH\nNewhaven Town|NVN\nNewington|NGT|1\nNorbiton|NBT\nNorbury|NRB\nNormans Bay|NSB\nNorth Dulwich|NDL\nNorth Fambridge|NFA\nNorth Sheen|NSH\nNorth Wembley|NWB\nNorthfleet - Cooper Arms|NFL|1\nNortholt Park|NLT\nNorthumberland Park|NUM\nNorwood Junction|NWD\nNunhead|NHD|1\nNutfield|NUF\nOakleigh Park|OKL\nOckendon|OCK\nOckley|OLY\nOld Street|OLD\nOre|ORE|1\nOrpington|ORP|1\nOtford|OTF\nOxshott|OXS\nOxted|OXT\nPaddock Wood|PDW|1\nPalmers Green|PAL\nPeckham Rye|PMR|1\nPenge East|PNE|1\nPenge West|PNW\nPenshurst|PHR\nPetts Wood|PET|1\nPevensey & Westham|PEV\nPevensey Bay|PEB\nPitsea|PSE\nPluckley|PLC|1\nPlumpton|PMP\nPlumstead|PLU|1\nPolegate|PLG\nPonders End|PON\nPortslade|PLD\nPotters Bar|PBR\nPreston Park|PRP\nPrittlewell|PRL\nPurfleet|PFL\nPurley|PUR\nPurley Oaks|PUO\nPutney|PUT\nQueenborough|QBR|1\nQueens Park (London)|QPW\nQueens Road Peckham|QRP\nQueenstown Road (Battersea)|QRB\nRadlett|RDT\nRainham (Essex)|RNM|1\nRainham (Kent)|RAI|1\nRamsgate|RAM|1\nRavensbourne|RVB|1\nRayleigh|RLG\nRaynes Park|RAY\nRectory Road|REC\nRedhill|RDH\nReedham (London)|RHM\nReigate|REI\nRichmond|RMD\nRiddlesdown|RDD\nRobertsbridge|RBR|1\nRochester|RTR|1\nRochford|RFD\nRomford|RMF\nRotherhithe|ROE\nRye|RYE|1\nSalfords|SAF\nSanderstead|SNR\nSandling|SDG|1\nSandwich|SDW|1\nSeaford|SEF\nSelhurst|SRS\nSelling|SEG|1\nSeven Kings|SVK\nSeven Sisters|SVS\nSevenoaks|SEV|1\nShadwell|SDE\nSheerness-On-Sea|SSS|1\nShenfield|SNF\nShepherds Bush|SPB\nShepherds Well|SPH|1\nShoeburyness|SRY\nShoreditch High Street|SDC\nShoreham (Kent)|SEH|1\nShoreham-By-Sea|SSE|1\nShortlands|SRT|1\nSidcup|SID|1\nSilver Street|SLV\nSittingbourne|SIT|1\nSlade Green|SGR|1\nSnodland|SDA|1\nSnowdown|SWO|1\nSole Street|SOR|1\nSouth Acton|SAT\nSouth Bermondsey|SBM\nSouth Croydon|SCY\nSouth Greenford|SGN\nSouth Hampstead|SOH\nSouth Kenton|SOK\nSouth Merton|SMO\nSouth Ruislip|SRU\nSouth Tottenham|STO\nSouth Woodham Ferrers|SOF\nSouthall|STL\nSouthbury|SBU\nSouthease|SEE\nSouthend Airport|SIA\nSouthend Central|SOC\nSouthend East|SOE\nSouthend Victoria|SOV\nSouthminster|SMN\nSouthwick|SWK\nSt Helier|SIH\nSt James Street|SJS\nSt Johns|SAJ|1\nSt Leonards Warrior Square|SLQ|1\nSt Margarets (London)|SMG\nSt Mary Cray|SMY|1\nStamford Hill|SMH\nStanford-Le-Hope|SFO\nStaplehurst|SPU|1\nStoke Newington|SKW\nStone Crossing|SCG|1\nStonebridge Park|SBP\nStonegate|SOG|1\nStoneleigh|SNL\nStratford (London)|SRA\nStratford International|SFA|1\nStrawberry Hill|STW\nStreatham|STE\nStreatham Common|SRC\nStreatham Hill|SRH\nStrood|SOO|1\nSturry|STU|1\nSudbury & Harrow Road|SUD\nSudbury Hill Harrow|SDH\nSundridge Park|SUP|1\nSurbiton|SUR\nSurrey Quays|SQE\nSutton (London)|SUO\nSutton Common|SUC\nSwale|SWL|1\nSwanley|SAY|1\nSwanscombe - George & Dragon|SWM|1\nSydenham|SYD|1\nSydenham Hill|SYH|1\nSyon Lane|SYL\nTadworth|TAD\nTattenham Corner|TAT\nTeddington|TED\nTeynham|TEY|1\nThames Ditton|THD\nThanet Parkway|THP|1\nTheobalds Grove|TEO\nThornton Heath|TTH\nThorpe Bay|TPB\nThree Bridges|TBD\nThree Oaks|TOK|1\nTilbury Town|TIL\nTolworth|TOL\nTonbridge|TON|1\nTooting|TOO\nTottenham Court Road|TCR\nTottenham Hale|TOM\nTulse Hill|TUH\nTunbridge Wells|TBW|1\nTurkey Street|TUR\nTwickenham|TWI\nUckfield|UCK\nUpminster|UPM\nUpper Holloway|UHL\nUpper Warlingham|UWL\nVauxhall|VXH\nWaddon|WDO\nWadhurst|WAD|1\nWallington|WLT\nWalmer|WAM|1\nWaltham Cross|WLC\nWalthamstow Central|WHC\nWalthamstow Queens Road|WMW\nWandsworth Common|WSW\nWandsworth Road|WWR\nWandsworth Town|WNT\nWanstead Park|WNP\nWapping|WPE\nWarnham|WNH\nWateringbury|WTR|1\nWatford High Street|WFH\nWatford Junction|WFJ\nWatford North|WFN\nWelling|WLI|1\nWembley Central|WMB\nWembley Stadium|WCX\nWest Brompton|WBP\nWest Croydon|WCY\nWest Dulwich|WDU|1\nWest Ealing|WEA\nWest Ham|WEH\nWest Hampstead|WHD\nWest Hampstead Thameslink|WHP\nWest Horndon|WHR\nWest Malling|WMA|1\nWest Norwood|WNW\nWest St Leonards|WLD|1\nWest Sutton|WSU\nWest Wickham|WWI|1\nWest Worthing|WWO\nWestcliff|WCF\nWestcombe Park|WCB|1\nWestenhanger|WHA|1\nWestgate-On-Sea|WGA|1\nWhite Hart Lane|WHL\nWhitechapel|ZLW\nWhitstable|WHI|1\nWhitton|WTN\nWhyteleafe|WHY\nWhyteleafe South|WHS\nWickford|WIC\nWillesden Junction|WIJ\nWimbledon|WIM\nWimbledon Chase|WBO\nWinchelsea|WSE|1\nWinchmore Hill|WIH\nWivelsfield|WVF\nWoldingham|WOH\nWood Street|WST\nWoodgrange Park|WGR\nWoodmansterne|WME\nWoolwich|WWC|1\nWoolwich Arsenal|WWA|1\nWoolwich Dockyard|WWD|1\nWorcester Park|WCP\nWorthing|WRH\nWye|WYE|1\nYalding|YAL|1";
const STATIONS = STATION_TABLE.split("\n").filter(function(l){return l.trim();})
  .map(function(l){ var p = l.split("|"); return [p[0], p[1], p.length > 2]; });
/* Places the resolver cannot get right on its own: depots, turnbacks and
   yards that are not passenger stations in their own right. */
const MANUAL_LOC = {
 "Folk E TR": ["FKE","Folkestone East"],   "Bell Sd":   ["BGM","Bellingham"],
 "Padd W":    ["PDW","Paddock Wood"],      "Brom N":    ["BMN","Bromley North"],
 "Bfrs":      ["BFR","London Blackfriars"],"TunWellTB": ["TBW","Tunbridge Wells"],
 "Strood625": ["SOO","Strood"],            "Tonbdg160": ["TON","Tonbridge"],
 "AshfDYWRd": ["AFK","Ashford International"], "RM DRW": ["RAM","Ramsgate"],
 "St L ShNk": ["XSE","St Leonards Shed"],  "Gvpuphs":   ["GRP","Grove Park"],
 "GrPkDCtEE": ["GRP","Grove Park"],        "SldGrDEHs": ["SGR","Slade Green"],
 "VictGroSh": ["VIC","London Victoria"],   "Ashfd EBS": ["AFE","Ashford East Sidings"],
};
/* At Dover Priory the two ends of a train are named for the way out: the
   Folkestone East end leads towards Charing Cross and Cannon Street, and the
   Canterbury East end leads towards Victoria and anything routed via
   Faversham. Only a train of two or more units is marked - the markers say
   which unit is on which end, so they mean nothing on a single unit. */
const END_MARKERS_PRINTS = {
 "DOVER PRIORY": {
   fke: "FKE END", cbe: "CBE END",
   fke_leads: new Set(["CHX","CST","TON","AFK"]),            // out via Folkestone
   cbe_leads: new Set(["VIC","FAV","SIT","RTR","SOO","GLM"]), // out via Faversham
   cbe_via:   new Set(["Fav"]),          // or anything the leg routes through
 },
};
/* ========================= book profiles ========================= */
const MAINLINE = {
 "ASHFORD":      ["Ashfrd DS","AshfDYWRd","Ashford I","Ash Up Sd","Ashfd EBS"],
 "DOVER PRIORY": ["Dover P","Dover PSd","Dover621","Dover623"],
 "FAVERSHAM":    ["Fav","Fav Bk Rd","Fav Up Sd","FV EK4327"],
 "GILLINGHAM":   ["Gill","Gill Dep","Gill US"],
 "GROVE PARK":   ["G Pk Dep","G Pk DnSd","G Pk UpSd","GrPkDCtEE","Gvpuphs"],
 "HASTINGS":     ["Hastings","Hast Pk S"],
 "ORPINGTON":    ["Orp","Orp Dn Sd"],
 "RAMSGATE":     ["Ram","Ram Depot","RM DRW","RMUSW","RamsNewSd",
                  "RM EK4981","RM EK4985","RM EK5143","RM EK5145"],
 "SLADE GREEN":  ["S Gn Dep","S Gn U Sd","SldGrDEHs"],
 "TONBRIDGE":    ["Tonbridge","Ton DMS","TonbJubS","Tonbdg160"],
 "VICTORIA":     ["Vic (E)","VictGroSh"],
 "WEST MARINA":  ["St L Shed","St L ShNk"],
};
const METRO = {
 "CANNON STREET":["C St"],
 "CHARING CROSS":["CX"],
 "DARTFORD":     ["Dart","Dart USd","Dart DSd"],
 "GILLINGHAM":   MAINLINE["GILLINGHAM"],
 "GROVE PARK":   MAINLINE["GROVE PARK"],
 "ORPINGTON":    MAINLINE["ORPINGTON"],
 "PLUMSTEAD":    ["Plum Sdg"],
 "RAMSGATE":     MAINLINE["RAMSGATE"],
 "SLADE GREEN":  MAINLINE["SLADE GREEN"],
 "TONBRIDGE":    MAINLINE["TONBRIDGE"],
 "VICTORIA":     MAINLINE["VICTORIA"],
};
const HIGHSPEED = {
 "ASHFORD":   MAINLINE["ASHFORD"],
 "FAVERSHAM": MAINLINE["FAVERSHAM"],
 "RAMSGATE":  MAINLINE["RAMSGATE"],
};
/* The weekend books follow the same rulebook as the weekday ones, so their
   profiles are the weekday profiles - not a second copy that can drift from
   them. It had drifted: the weekend metro fleet list had lost 465/0, and
   its headcode sections had gained Slade Green while the High Speed book
   had none at all. The only weekday rule NOT carried over is the pinned
   unit order (ORDER_FIX): those pins are keyed on weekday diagram numbers
   and the weekend prints number their diagrams separately. */
const PROFILES = [
 {tag:"", label:"375/376/377", road:"Mainline", sections:MAINLINE},
 {tag:"465_466_707", label:"465/466/707", road:"Metro", sections:METRO},
 {tag:"395", label:"395", road:"High Speed", sections:HIGHSPEED},
].map((p, i) => {
  const g = PROFILES_G[i];
  return {
    tag: p.tag, label: p.label, road: p.road, sections: p.sections,
    fleets: g.fleets,
    headcode_sections: HEADCODE_SECTIONS,
    pos_asc: g.posAsc, road_pos_asc: g.roadPosAsc,
    /* The weekend High Speed book is still a berthing book and nobody has
       held one against a marked-up copy timed off the first move, so it
       keeps the platform departure. The weekday side moved because the
       operator's own allocation sheet is timed that way. */
    first_dep: g.firstDep,
    first_dep_all: g.bucket === "hs" ? false : !!g.firstDepAll,
    ecs_only_ok: g.ecsOnlyOk,
  };
});

return {
  DEST_TLC, BERTH_SHEETS, NON_BERTH_VISIT, SIDING_CLASS_RE,
  MAIN_ORDER, METRO_ORDER, HS_ORDER, HEADCODE_SECTIONS, GP_ROAD,
  SIDING_NOTES, END_STYLE, DAY_SHEET,
  CODE2NAME, GROUP_EXTRA, STABLE_CODES, NAME_CODE, FIX_CODE,
  PROFILES_G, MINOR_SPUR, BERTH_AREAS, END_MARKERS_GENIUS, ORDER_FIX,
  PLATFORM_TURN,
  ROUTE_BY_HC, routeRule,
  DEST_CODE, BERTH_CODE, NOTE_FROM_BERTH, PLATFORM, BASE_STABLING,
  TRANSIT, STATION_TABLE, STATIONS, MANUAL_LOC, END_MARKERS_PRINTS,
  PROFILES,
};
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_DATA;
if (typeof globalThis !== "undefined") globalThis.SHEETS_DATA = SHEETS_DATA;
