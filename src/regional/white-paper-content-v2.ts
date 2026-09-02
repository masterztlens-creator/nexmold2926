/**
 * NEXMOLD V7.14
 * White Paper Content Engine v2
 *
 * Purpose:
 * Produce engineering-grade long-form white papers.
 *
 * IMPORTANT:
 * This module does NOT copy source KnowledgeArticle content.
 *
 * It uses:
 *   Topic Definition
 *   -> Engineering Dimensions
 *   -> Design Rules
 *   -> Failure Modes
 *   -> Manufacturing Constraints
 *   -> Validation
 *   -> Long-tail Query Expansion
 *   -> FAQ
 *
 * Output is intended for:
 *   /industries/v714/[slug]/
 */

export interface WhitePaperSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface WhitePaperDocument {
  title: string;
  description: string;
  category: string;
  slug: string;
  executiveSummary: string;
  directAnswer: string;
  keyTakeaways: string[];
  sections: WhitePaperSection[];
  faq: {
    question: string;
    answer: string;
  }[];
  longTailQueries: string[];
  relatedTopics: string[];
}

interface TopicProfile {
  slug: string;
  title: string;
  category: string;
  description: string;
  entity: string;
  primaryVariables: string[];
  designRules: string[];
  failureModes: string[];
  manufacturingFactors: string[];
  validationMethods: string[];
  comparisonTopics: string[];
  longTailModifiers: string[];
  relatedTopics: string[];
  coreExplanation: string;
  engineeringPrinciple: string;
}

const TOPICS: Record<string, TopicProfile> = {
  "injection-molding-wall-thickness-design": {
    slug: "injection-molding-wall-thickness-design",
    title:
      "Injection Molding Wall Thickness Design: An Engineering White Paper",
    category: "Injection Molding Design",
    description:
      "A technical white paper covering injection molding wall thickness, flow behavior, cooling, sink marks, warpage, material selection, DFM rules, and validation strategy.",
    entity: "injection molded part wall thickness",
    primaryVariables: [
      "nominal wall thickness",
      "wall-to-wall transitions",
      "material viscosity",
      "flow length",
      "cooling time",
      "packing pressure",
      "fiber orientation",
      "mold temperature",
    ],
    designRules: [
      "Keep nominal wall thickness as uniform as practical.",
      "Use gradual transitions rather than abrupt thickness changes.",
      "Avoid creating isolated heavy sections behind cosmetic surfaces.",
      "Use ribs and structural features instead of simply increasing wall thickness.",
      "Evaluate flow length relative to the selected material and gate strategy.",
    ],
    failureModes: [
      "sink marks",
      "voids",
      "warpage",
      "short shots",
      "hesitation",
      "inconsistent filling",
      "excessive cycle time",
    ],
    manufacturingFactors: [
      "mold filling",
      "packing",
      "cooling",
      "ejection",
      "material shrinkage",
      "mold temperature",
      "gate location",
    ],
    validationMethods: [
      "DFM review",
      "moldflow analysis",
      "fill-pressure analysis",
      "cooling analysis",
      "prototype inspection",
      "dimensional capability study",
    ],
    comparisonTopics: [
      "thin-wall molding versus conventional molding",
      "uniform wall versus stepped wall",
      "thick wall versus rib reinforcement",
    ],
    longTailModifiers: [
      "design guidelines",
      "DFM rules",
      "recommended thickness",
      "sink mark prevention",
      "warpage prevention",
      "plastic part design",
      "ABS",
      "PC",
      "glass-filled nylon",
      "PP",
    ],
    relatedTopics: [
      "injection-molding-rib-design",
      "injection-molding-sink-marks-causes-solutions",
      "injection-molding-warpage-causes-solutions",
      "injection-molding-gate-location",
    ],
    coreExplanation:
      "Wall thickness is one of the highest-leverage variables in injection molded part design because it affects filling, packing, cooling, shrinkage, dimensional stability, cosmetic quality, and cycle time simultaneously.",
    engineeringPrinciple:
      "The objective is not simply to make every wall thin. The engineering objective is to establish a manufacturable nominal section that allows predictable filling and cooling while providing the required structural performance.",
  },

  "injection-molding-rib-design": {
    slug: "injection-molding-rib-design",
    title:
      "Injection Molding Rib Design: Structural Reinforcement Without Sink Marks",
    category: "Injection Molding Design",
    description:
      "Engineering guidance for rib thickness, rib height, draft, intersection design, stiffness, sink prevention, flow behavior, and DFM validation.",
    entity: "injection molded ribs",
    primaryVariables: [
      "rib thickness",
      "rib height",
      "rib draft",
      "rib-to-wall ratio",
      "rib intersection",
      "material shrinkage",
      "ejection direction",
      "load direction",
    ],
    designRules: [
      "Use ribs to increase bending stiffness without creating unnecessarily thick sections.",
      "Control rib thickness relative to the nominal wall.",
      "Provide adequate draft for reliable ejection.",
      "Avoid concentrating multiple heavy intersections in one location.",
      "Orient ribs according to the dominant structural load where practical.",
    ],
    failureModes: [
      "sink marks",
      "warpage",
      "short fill",
      "ejection damage",
      "rib breakage",
      "stress concentration",
    ],
    manufacturingFactors: [
      "mold filling",
      "cooling",
      "ejection",
      "tool steel access",
      "core machining",
      "venting",
    ],
    validationMethods: [
      "DFM review",
      "flow simulation",
      "structural FEA",
      "sink-risk review",
      "ejection review",
      "prototype testing",
    ],
    comparisonTopics: [
      "thick wall versus rib reinforcement",
      "solid boss versus rib-supported boss",
      "single rib versus rib network",
    ],
    longTailModifiers: [
      "thickness ratio",
      "design rules",
      "DFM",
      "sink mark prevention",
      "draft angle",
      "plastic enclosure",
      "structural ribs",
      "ABS",
      "PP",
      "PA66",
    ],
    relatedTopics: [
      "injection-molding-wall-thickness-design",
      "injection-molding-boss-design",
      "injection-molding-corner-radius",
    ],
    coreExplanation:
      "Ribs are structural features that increase stiffness efficiently, but they also create local mass concentrations and can strongly influence filling, cooling, shrinkage, and cosmetic appearance.",
    engineeringPrinciple:
      "A well-designed rib increases section stiffness while avoiding the heavy plastic concentration that would occur if the entire surrounding wall were simply thickened.",
  },

  "injection-molding-boss-design": {
    slug: "injection-molding-boss-design",
    title:
      "Injection Molding Boss Design: Screw Bosses, Inserts, Draft, Cooling and DFM",
    category: "Injection Molding Design",
    description:
      "A practical engineering white paper covering injection molded bosses, screw retention, insert interfaces, wall thickness, ribs, draft, sink marks and tooling constraints.",
    entity: "injection molded boss",
    primaryVariables: [
      "boss outer diameter",
      "boss inner diameter",
      "boss wall thickness",
      "boss height",
      "draft",
      "screw type",
      "insert type",
      "rib support",
    ],
    designRules: [
      "Avoid excessively thick boss walls.",
      "Use ribs to support tall bosses when structural loads require it.",
      "Provide adequate draft and ejection clearance.",
      "Consider screw installation loads during design.",
      "Evaluate the interaction between boss geometry and cosmetic surfaces.",
    ],
    failureModes: [
      "sink marks",
      "cracking",
      "boss breakage",
      "ejection sticking",
      "insert misalignment",
      "stress whitening",
    ],
    manufacturingFactors: [
      "core pin design",
      "cooling",
      "ejection",
      "insert molding",
      "tool access",
      "steel strength",
    ],
    validationMethods: [
      "DFM",
      "screw pull-out testing",
      "torque testing",
      "insert retention testing",
      "dimensional inspection",
      "moldflow review",
    ],
    comparisonTopics: [
      "self-tapping screw boss versus threaded insert",
      "free-standing boss versus rib-supported boss",
      "plastic boss versus metal insert",
    ],
    longTailModifiers: [
      "screw boss design",
      "boss thickness",
      "boss diameter",
      "insert molding",
      "DFM",
      "sink prevention",
      "plastic enclosure",
      "threaded insert",
    ],
    relatedTopics: [
      "injection-molding-rib-design",
      "injection-molding-wall-thickness-design",
      "injection-molding-undercuts-guide",
    ],
    coreExplanation:
      "Injection molded bosses combine structural, fastening, cooling, ejection, and tooling requirements in a small geometric feature.",
    engineeringPrinciple:
      "The boss should be designed as part of the surrounding load path and cooling system rather than treated as an isolated cylindrical feature.",
  },

  "injection-molding-corner-radius": {
    slug: "injection-molding-corner-radius",
    title:
      "Injection Molding Corner Radius Design: Stress, Flow, Cooling and Tooling",
    category: "Injection Molding Design",
    description:
      "Engineering white paper on internal and external corner radii, stress concentration, polymer flow, machining, moldability and cosmetic quality.",
    entity: "injection molded corner radius",
    primaryVariables: [
      "internal radius",
      "external radius",
      "wall thickness",
      "material modulus",
      "flow direction",
      "tooling method",
      "surface finish",
    ],
    designRules: [
      "Avoid sharp internal corners where structural or flow requirements make them unnecessary.",
      "Use radius transitions that are compatible with the nominal wall.",
      "Consider machining limitations when specifying mold radii.",
      "Use larger radii where stress concentration is critical.",
      "Review radius changes at parting lines and shutoffs.",
    ],
    failureModes: [
      "stress concentration",
      "cracking",
      "flow hesitation",
      "weld-line weakness",
      "sink",
      "tooling difficulty",
    ],
    manufacturingFactors: [
      "CNC machining",
      "EDM",
      "polishing",
      "steel hardness",
      "flow behavior",
      "cooling",
    ],
    validationMethods: [
      "FEA",
      "DFM review",
      "moldflow",
      "prototype testing",
      "tooling review",
    ],
    comparisonTopics: [
      "sharp corner versus radiused corner",
      "small radius versus large radius",
      "cosmetic radius versus structural radius",
    ],
    longTailModifiers: [
      "internal radius",
      "external radius",
      "DFM",
      "stress concentration",
      "plastic part design",
      "mold machining",
    ],
    relatedTopics: [
      "injection-molding-wall-thickness-design",
      "injection-molding-parting-line-design",
    ],
    coreExplanation:
      "Corner radius controls more than appearance. It affects stress concentration, polymer flow, local cooling behavior, tool manufacturability and mold polishing.",
    engineeringPrinciple:
      "The most robust geometry uses radius transitions that respect both the polymer's mechanical behavior and the moldmaker's ability to machine, polish and maintain the feature.",
  },

  "injection-molding-undercuts-guide": {
    slug: "injection-molding-undercuts-guide",
    title:
      "Injection Molding Undercuts: Side Actions, Lifters, Slides and DFM Strategy",
    category: "Injection Mold Tooling",
    description:
      "Technical guide to injection molding undercuts, side actions, lifters, slides, parting strategies, tooling complexity and cost.",
    entity: "injection mold undercut",
    primaryVariables: [
      "undercut depth",
      "undercut direction",
      "ejection direction",
      "parting line",
      "slide travel",
      "lifter geometry",
      "tooling space",
      "cycle time",
    ],
    designRules: [
      "First determine whether the undercut is truly required.",
      "Evaluate whether the parting line can be changed to eliminate the mechanism.",
      "Use lifters for suitable internal features.",
      "Use slides or side actions for lateral external features.",
      "Consider maintenance access before committing to complex mechanisms.",
    ],
    failureModes: [
      "sticking",
      "mechanism interference",
      "premature wear",
      "flash",
      "ejection damage",
      "tooling failure",
    ],
    manufacturingFactors: [
      "slide design",
      "lifter design",
      "wear plates",
      "lubrication",
      "steel selection",
      "maintenance",
    ],
    validationMethods: [
      "moldflow",
      "mold design review",
      "motion simulation",
      "DFM",
      "tooling feasibility review",
    ],
    comparisonTopics: [
      "slider versus lifter",
      "side action versus parting-line redesign",
      "mechanical undercut versus collapsible core",
    ],
    longTailModifiers: [
      "slider",
      "lifter",
      "side action",
      "tooling cost",
      "DFM",
      "mold design",
      "complex injection mold",
    ],
    relatedTopics: [
      "injection-molding-parting-line-design",
      "injection-molding-boss-design",
    ],
    coreExplanation:
      "An undercut is not merely a geometric feature; it is a tooling decision that can add mechanisms, maintenance points, cycle time and cost.",
    engineeringPrinciple:
      "The best undercut strategy minimizes mechanism complexity while preserving part function, reliable ejection and acceptable tool life.",
  },

  "injection-molding-parting-line-design": {
    slug: "injection-molding-parting-line-design",
    title:
      "Injection Mold Parting Line Design: DFM, Flash, Ejection and Cosmetic Control",
    category: "Injection Mold Tooling",
    description:
      "Engineering white paper on parting line placement, shutoffs, flash risk, ejection, tooling access and cosmetic surface strategy.",
    entity: "injection mold parting line",
    primaryVariables: [
      "part geometry",
      "ejection direction",
      "draft",
      "shutoff angle",
      "cosmetic surface",
      "flash risk",
      "tool access",
      "mold construction",
    ],
    designRules: [
      "Place the parting line where it can be tolerated functionally and cosmetically.",
      "Avoid unnecessary shutoff complexity.",
      "Align parting strategy with ejection direction.",
      "Consider flash witness visibility.",
      "Provide adequate draft around shutoff surfaces.",
    ],
    failureModes: [
      "flash",
      "mismatch",
      "witness marks",
      "ejection problems",
      "shutoff wear",
      "tooling instability",
    ],
    manufacturingFactors: [
      "mold assembly",
      "CNC machining",
      "EDM",
      "polishing",
      "alignment",
      "steel condition",
    ],
    validationMethods: [
      "DFM review",
      "mold design review",
      "parting-line simulation",
      "prototype inspection",
    ],
    comparisonTopics: [
      "visible versus hidden parting line",
      "straight parting line versus stepped parting line",
      "simple shutoff versus complex shutoff",
    ],
    longTailModifiers: [
      "DFM",
      "flash prevention",
      "mold design",
      "shutoff",
      "cosmetic part",
      "parting line witness",
    ],
    relatedTopics: [
      "injection-molding-undercuts-guide",
      "injection-molding-gate-location",
    ],
    coreExplanation:
      "Parting line placement determines how the mold separates, how the part ejects, where flash can occur and where witness lines may remain.",
    engineeringPrinciple:
      "Parting-line design is an optimization between mold simplicity, ejection reliability, functional interfaces and cosmetic requirements.",
  },

  "injection-molding-gate-location": {
    slug: "injection-molding-gate-location",
    title:
      "Injection Molding Gate Location: Flow, Weld Lines, Packing, Warpage and DFM",
    category: "Injection Molding Process",
    description:
      "Engineering white paper covering gate location, filling pattern, pressure drop, weld lines, fiber orientation, packing and warpage.",
    entity: "injection mold gate location",
    primaryVariables: [
      "gate location",
      "flow length",
      "gate type",
      "fill time",
      "packing pressure",
      "weld-line location",
      "fiber orientation",
      "cosmetic requirements",
    ],
    designRules: [
      "Gate into regions that support predictable filling and packing.",
      "Avoid placing critical cosmetic or structural features at unfavorable weld-line locations.",
      "Consider fiber orientation in reinforced materials.",
      "Evaluate gate vestige requirements.",
      "Balance filling and packing behavior against cosmetic constraints.",
    ],
    failureModes: [
      "short shot",
      "weld lines",
      "air traps",
      "jetting",
      "warpage",
      "burn marks",
      "gate blush",
    ],
    manufacturingFactors: [
      "runner design",
      "gate diameter",
      "hot runner",
      "cold runner",
      "mold temperature",
      "injection pressure",
    ],
    validationMethods: [
      "fill analysis",
      "pressure analysis",
      "weld-line prediction",
      "fiber orientation analysis",
      "prototype validation",
    ],
    comparisonTopics: [
      "edge gate versus pin gate",
      "hot runner versus cold runner",
      "single gate versus multiple gates",
    ],
    longTailModifiers: [
      "gate design",
      "gate placement",
      "weld line",
      "warpage",
      "moldflow",
      "hot runner",
      "cold runner",
    ],
    relatedTopics: [
      "injection-molding-weld-lines-causes-solutions",
      "injection-molding-warpage-causes-solutions",
      "injection-molding-parting-line-design",
    ],
    coreExplanation:
      "Gate location determines how molten polymer enters and fills the cavity, making it one of the most influential variables in injection molding quality.",
    engineeringPrinciple:
      "Gate placement should be selected from the complete flow, packing, cooling and cosmetic system rather than from geometry alone.",
  },

  "injection-molding-sink-marks-causes-solutions": {
    slug: "injection-molding-sink-marks-causes-solutions",
    title:
      "Injection Molding Sink Marks: Causes, Root Causes, Prevention and Process Control",
    category: "Injection Molding Defects",
    description:
      "Engineering white paper on sink marks, thick sections, ribs, bosses, packing, cooling, shrinkage and corrective actions.",
    entity: "injection molding sink marks",
    primaryVariables: [
      "section thickness",
      "packing pressure",
      "packing time",
      "mold temperature",
      "cooling time",
      "material shrinkage",
      "rib thickness",
      "boss geometry",
    ],
    designRules: [
      "Control local mass concentration.",
      "Use ribs instead of excessive wall thickness.",
      "Avoid thick intersections behind cosmetic surfaces.",
      "Provide sufficient packing access to heavy sections.",
      "Use cooling strategy appropriate to local geometry.",
    ],
    failureModes: [
      "surface depressions",
      "internal voids",
      "dimensional drift",
      "cosmetic rejection",
    ],
    manufacturingFactors: [
      "packing pressure",
      "packing time",
      "gate freeze",
      "cooling",
      "mold temperature",
      "material shrinkage",
    ],
    validationMethods: [
      "moldflow",
      "section analysis",
      "weight monitoring",
      "dimensional inspection",
      "process capability",
    ],
    comparisonTopics: [
      "sink mark versus void",
      "design correction versus process correction",
      "packing correction versus cooling correction",
    ],
    longTailModifiers: [
      "causes",
      "solutions",
      "prevention",
      "troubleshooting",
      "rib sink",
      "boss sink",
      "plastic molding defects",
    ],
    relatedTopics: [
      "injection-molding-wall-thickness-design",
      "injection-molding-rib-design",
      "injection-molding-boss-design",
    ],
    coreExplanation:
      "Sink marks occur when local volumetric shrinkage is not adequately compensated and the surrounding surface cannot maintain its intended geometry.",
    engineeringPrinciple:
      "Sink-mark troubleshooting should begin by separating geometry-driven mass concentration from process-driven packing and cooling limitations.",
  },

  "injection-molding-warpage-causes-solutions": {
    slug: "injection-molding-warpage-causes-solutions",
    title:
      "Injection Molding Warpage: Causes, Physics, Simulation and Corrective Action",
    category: "Injection Molding Defects",
    description:
      "Technical white paper on differential shrinkage, cooling imbalance, fiber orientation, packing, geometry and warpage control.",
    entity: "injection molding warpage",
    primaryVariables: [
      "differential shrinkage",
      "cooling balance",
      "packing",
      "fiber orientation",
      "wall thickness",
      "gate location",
      "mold temperature",
      "ejection temperature",
    ],
    designRules: [
      "Maintain geometric balance where possible.",
      "Avoid abrupt thickness transitions.",
      "Consider fiber orientation in reinforced polymers.",
      "Design cooling around the actual heat-load distribution.",
      "Align gate strategy with dimensional requirements.",
    ],
    failureModes: [
      "bowing",
      "twisting",
      "corner lift",
      "flatness failure",
      "dimensional drift",
    ],
    manufacturingFactors: [
      "cooling channel layout",
      "mold temperature",
      "packing profile",
      "ejection timing",
      "material conditioning",
    ],
    validationMethods: [
      "moldflow warpage analysis",
      "3D scanning",
      "flatness measurement",
      "process capability",
      "DOE",
    ],
    comparisonTopics: [
      "cooling-induced warpage versus orientation-induced warpage",
      "design correction versus process correction",
      "conventional cooling versus conformal cooling",
    ],
    longTailModifiers: [
      "causes",
      "solutions",
      "prevention",
      "simulation",
      "moldflow",
      "fiber-filled plastic",
      "cooling",
    ],
    relatedTopics: [
      "conformal-cooling-injection-mold",
      "injection-molding-wall-thickness-design",
      "injection-molding-gate-location",
    ],
    coreExplanation:
      "Warpage is generally the visible result of non-uniform volumetric change and residual stress across a molded part.",
    engineeringPrinciple:
      "Reliable warpage control requires balancing material behavior, geometry, filling, packing, cooling and ejection rather than adjusting one process parameter in isolation.",
  },

  "injection-molding-weld-lines-causes-solutions": {
    slug: "injection-molding-weld-lines-causes-solutions",
    title:
      "Injection Molding Weld Lines: Flow Front Physics, Strength, Appearance and Prevention",
    category: "Injection Molding Defects",
    description:
      "Engineering white paper covering weld-line formation, flow fronts, venting, gate strategy, temperature, strength and cosmetic control.",
    entity: "injection molding weld lines",
    primaryVariables: [
      "flow-front temperature",
      "gate location",
      "flow path",
      "venting",
      "injection speed",
      "mold temperature",
      "material chemistry",
      "fiber orientation",
    ],
    designRules: [
      "Predict weld-line locations before tool release.",
      "Avoid placing critical structural features at weak weld-line locations.",
      "Provide effective venting near converging flow fronts.",
      "Evaluate gate strategy for critical cosmetic surfaces.",
      "Use process conditions that preserve flow-front temperature where appropriate.",
    ],
    failureModes: [
      "reduced weld strength",
      "visible weld lines",
      "burn marks",
      "short shots",
      "surface defects",
    ],
    manufacturingFactors: [
      "venting",
      "gate design",
      "injection speed",
      "mold temperature",
      "material drying",
    ],
    validationMethods: [
      "moldflow",
      "weld-line strength testing",
      "visual inspection",
      "cross-section analysis",
    ],
    comparisonTopics: [
      "weld line versus knit line",
      "design correction versus process correction",
      "single gate versus multiple gates",
    ],
    longTailModifiers: [
      "causes",
      "solutions",
      "strength",
      "appearance",
      "prevention",
      "moldflow",
      "venting",
    ],
    relatedTopics: [
      "injection-molding-gate-location",
      "injection-molding-parting-line-design",
    ],
    coreExplanation:
      "A weld line forms when separate polymer flow fronts meet and the interface does not fully develop the same molecular or fiber structure as the surrounding material.",
    engineeringPrinciple:
      "Weld-line control begins with flow-path design and must then be supported by venting, temperature and process-window control.",
  },

  "s136-vs-nak80-mold-steel": {
    slug: "s136-vs-nak80-mold-steel",
    title:
      "S136 vs NAK80 Mold Steel: Corrosion Resistance, Polishability, Machining and Tool Life",
    category: "Injection Mold Materials",
    description:
      "Engineering comparison of S136 and NAK80 mold steels for injection mold applications, including corrosion resistance, polishability, machining and maintenance.",
    entity: "S136 versus NAK80 mold steel",
    primaryVariables: [
      "corrosion resistance",
      "polishability",
      "hardness",
      "machinability",
      "surface finish",
      "wear",
      "tool life",
      "material environment",
    ],
    designRules: [
      "Select mold steel from actual production requirements rather than brand familiarity.",
      "Consider resin chemistry and moisture exposure.",
      "Evaluate required polish level.",
      "Balance machining time against service life.",
      "Consider repair and maintenance strategy.",
    ],
    failureModes: [
      "corrosion",
      "surface degradation",
      "wear",
      "polishing defects",
      "dimensional instability",
    ],
    manufacturingFactors: [
      "rough machining",
      "finish machining",
      "EDM",
      "polishing",
      "heat treatment",
      "maintenance",
    ],
    validationMethods: [
      "steel certification",
      "hardness testing",
      "surface inspection",
      "tool-life monitoring",
      "production trial",
    ],
    comparisonTopics: [
      "S136 versus NAK80",
      "corrosion-resistant steel versus pre-hardened steel",
      "polishability versus machining efficiency",
    ],
    longTailModifiers: [
      "comparison",
      "properties",
      "hardness",
      "polishability",
      "corrosion resistance",
      "mold life",
      "injection mold steel selection",
    ],
    relatedTopics: [
      "conformal-cooling-injection-mold",
      "injection-molding-parting-line-design",
    ],
    coreExplanation:
      "S136 and NAK80 are selected for different combinations of corrosion resistance, polishability, hardness, machining behavior and production requirements.",
    engineeringPrinciple:
      "Mold-steel selection should be treated as a lifecycle decision covering machining, surface quality, corrosion exposure, maintenance and expected production volume.",
  },

  "conformal-cooling-injection-mold": {
    slug: "conformal-cooling-injection-mold",
    title:
      "Conformal Cooling in Injection Molds: Thermal Design, Cycle Time and Warpage Control",
    category: "Injection Mold Cooling",
    description:
      "Engineering white paper on conformal cooling channels, additive manufacturing, heat transfer, cycle-time reduction and warpage control.",
    entity: "conformal cooling injection mold",
    primaryVariables: [
      "channel geometry",
      "coolant flow rate",
      "heat-transfer coefficient",
      "distance to cavity surface",
      "pressure drop",
      "mold steel",
      "part geometry",
      "cooling uniformity",
    ],
    designRules: [
      "Design cooling around the actual thermal load.",
      "Maintain consistent channel distance where geometry permits.",
      "Check coolant flow and pressure drop.",
      "Evaluate manufacturability and insert assembly.",
      "Validate thermal performance rather than assuming conformal geometry automatically improves cooling.",
    ],
    failureModes: [
      "hot spots",
      "uneven cooling",
      "warpage",
      "long cycle time",
      "coolant leakage",
      "pressure loss",
    ],
    manufacturingFactors: [
      "additive manufacturing",
      "laser powder bed fusion",
      "brazed inserts",
      "machined cooling",
      "sealing",
      "surface finishing",
    ],
    validationMethods: [
      "thermal simulation",
      "CFD",
      "pressure testing",
      "thermal imaging",
      "cycle-time measurement",
      "warpage measurement",
    ],
    comparisonTopics: [
      "conformal cooling versus conventional drilling",
      "conformal insert versus baffle",
      "thermal performance versus tooling cost",
    ],
    longTailModifiers: [
      "cycle time",
      "warpage",
      "thermal analysis",
      "3D printed mold",
      "cooling channel design",
      "DFM",
    ],
    relatedTopics: [
      "injection-molding-warpage-causes-solutions",
      "injection-molding-cycle-time-optimization-guide",
    ],
    coreExplanation:
      "Conformal cooling places coolant passages closer to the cavity geometry and can improve thermal uniformity where conventional straight drilling cannot follow the heat-load distribution.",
    engineeringPrinciple:
      "The value of conformal cooling comes from controlling thermal gradients, not simply from making the channel shape follow the cavity.",
  },

  "abs-injection-molding-design-guide": {
    slug: "abs-injection-molding-design-guide",
    title:
      "ABS Injection Molding Design Guide: DFM, Wall Thickness, Gates, Cooling and Defects",
    category: "Injection Molding Materials",
    description:
      "Engineering guide to ABS injection molding design, processing behavior, wall thickness, gates, cooling, appearance and common defects.",
    entity: "ABS injection molding",
    primaryVariables: [
      "ABS grade",
      "melt temperature",
      "mold temperature",
      "wall thickness",
      "flow length",
      "packing",
      "cooling",
      "surface finish",
    ],
    designRules: [
      "Select ABS grade according to impact, flow and appearance requirements.",
      "Maintain consistent wall sections.",
      "Control gate placement around cosmetic and structural requirements.",
      "Account for shrinkage and cooling behavior.",
      "Dry resin according to supplier requirements.",
    ],
    failureModes: [
      "sink marks",
      "warpage",
      "weld lines",
      "burn marks",
      "silver streaks",
      "short shots",
    ],
    manufacturingFactors: [
      "drying",
      "melt temperature",
      "mold temperature",
      "injection speed",
      "packing",
      "cooling",
    ],
    validationMethods: [
      "material certification",
      "moldflow",
      "dimensional inspection",
      "appearance inspection",
      "process capability",
    ],
    comparisonTopics: [
      "ABS versus PC",
      "standard ABS versus high-flow ABS",
      "painted ABS versus textured ABS",
    ],
    longTailModifiers: [
      "design guide",
      "DFM",
      "wall thickness",
      "processing temperature",
      "gate design",
      "defects",
      "plastic part design",
    ],
    relatedTopics: [
      "pc-injection-molding-design-guide",
      "injection-molding-wall-thickness-design",
    ],
    coreExplanation:
      "ABS is widely used because it combines processability, impact performance and surface quality, but grade selection and moisture/process control remain critical.",
    engineeringPrinciple:
      "ABS part design should be evaluated jointly with the selected resin grade, cosmetic requirements, flow length and cooling strategy.",
  },

  "pc-injection-molding-design-guide": {
    slug: "pc-injection-molding-design-guide",
    title:
      "PC Injection Molding Design Guide: Drying, Stress, Gates, Cooling and DFM",
    category: "Injection Molding Materials",
    description:
      "Engineering white paper covering polycarbonate injection molding, drying, residual stress, wall thickness, gates, cooling and defect prevention.",
    entity: "polycarbonate injection molding",
    primaryVariables: [
      "PC grade",
      "moisture content",
      "melt temperature",
      "mold temperature",
      "residual stress",
      "wall thickness",
      "gate design",
      "cooling",
    ],
    designRules: [
      "Control moisture aggressively before molding.",
      "Avoid unnecessary sharp transitions that increase stress.",
      "Design gate locations to minimize optical and structural problems.",
      "Control cooling to reduce residual stress.",
      "Select grade according to optical, impact and thermal requirements.",
    ],
    failureModes: [
      "splay",
      "cracking",
      "crazing",
      "stress whitening",
      "warpage",
      "flow marks",
    ],
    manufacturingFactors: [
      "drying",
      "melt temperature",
      "mold temperature",
      "injection speed",
      "packing",
      "annealing",
    ],
    validationMethods: [
      "moisture verification",
      "moldflow",
      "stress inspection",
      "dimensional inspection",
      "optical inspection",
    ],
    comparisonTopics: [
      "PC versus ABS",
      "PC versus PC/ABS",
      "optical PC versus general-purpose PC",
    ],
    longTailModifiers: [
      "design guide",
      "drying",
      "processing",
      "residual stress",
      "optical molding",
      "DFM",
      "defects",
    ],
    relatedTopics: [
      "abs-injection-molding-design-guide",
      "injection-molding-corner-radius",
    ],
    coreExplanation:
      "Polycarbonate combines high impact performance and thermal capability with demanding moisture and residual-stress control requirements.",
    engineeringPrinciple:
      "For PC, material conditioning and thermal history are part of the design problem, not merely production settings.",
  },

  "injection-molding-cycle-time-optimization-guide": {
    slug: "injection-molding-cycle-time-optimization-guide",
    title:
      "Injection Molding Cycle Time Optimization: Cooling, Filling, Packing and Process Economics",
    category: "Injection Molding Process",
    description:
      "Engineering white paper on cycle-time optimization, cooling, filling, packing, ejection, mold thermal design and production economics.",
    entity: "injection molding cycle time",
    primaryVariables: [
      "cooling time",
      "fill time",
      "packing time",
      "mold temperature",
      "part thickness",
      "cooling-channel layout",
      "ejection temperature",
      "machine capability",
    ],
    designRules: [
      "Treat cooling as a thermal design problem.",
      "Do not reduce cycle time by compromising dimensional stability.",
      "Measure each cycle phase separately.",
      "Optimize cooling-channel efficiency before blindly reducing hold time.",
      "Validate changes using dimensional and process-capability data.",
    ],
    failureModes: [
      "warpage",
      "ejection deformation",
      "sink marks",
      "incomplete packing",
      "dimensional drift",
    ],
    manufacturingFactors: [
      "machine response",
      "cooling system",
      "mold temperature controller",
      "ejection system",
      "robot automation",
    ],
    validationMethods: [
      "cycle-time measurement",
      "DOE",
      "thermal analysis",
      "dimensional capability",
      "OEE analysis",
    ],
    comparisonTopics: [
      "cooling optimization versus injection optimization",
      "conventional versus conformal cooling",
      "cycle reduction versus quality risk",
    ],
    longTailModifiers: [
      "optimization",
      "cooling time",
      "cycle reduction",
      "productivity",
      "OEE",
      "cost reduction",
      "process optimization",
    ],
    relatedTopics: [
      "conformal-cooling-injection-mold",
      "injection-molding-wall-thickness-design",
    ],
    coreExplanation:
      "Cycle time is dominated by the thermal and mechanical constraints required to produce a part that can be ejected and meet dimensional requirements.",
    engineeringPrinciple:
      "The correct optimization target is minimum stable cycle time, not simply the shortest machine cycle observed during a trial.",
  },

  "injection-molding-cavity-balance-guide": {
    slug: "injection-molding-cavity-balance-guide",
    title:
      "Injection Mold Cavity Balance: Multi-Cavity Filling, Pressure, Runner Design and Quality",
    category: "Injection Mold Tooling",
    description:
      "Engineering white paper on multi-cavity mold balance, runner systems, pressure distribution, filling consistency and process capability.",
    entity: "multi-cavity injection mold balance",
    primaryVariables: [
      "cavity count",
      "runner length",
      "runner diameter",
      "gate restriction",
      "pressure drop",
      "fill time",
      "temperature balance",
      "cavity-to-cavity variation",
    ],
    designRules: [
      "Design runner layouts for balanced flow paths.",
      "Evaluate rheology rather than relying only on geometric symmetry.",
      "Account for gate restriction and pressure loss.",
      "Validate cavity-to-cavity fill behavior.",
      "Monitor cavity-specific quality during production.",
    ],
    failureModes: [
      "cavity imbalance",
      "weight variation",
      "fill variation",
      "dimensional variation",
      "flash",
      "short shot",
    ],
    manufacturingFactors: [
      "runner machining",
      "hot runner balancing",
      "gate consistency",
      "temperature control",
      "process monitoring",
    ],
    validationMethods: [
      "moldflow",
      "pressure monitoring",
      "cavity weight comparison",
      "fill-time measurement",
      "capability study",
    ],
    comparisonTopics: [
      "naturally balanced versus artificially balanced runners",
      "cold runner versus hot runner",
      "two-cavity versus eight-cavity tooling",
    ],
    longTailModifiers: [
      "multi-cavity",
      "runner balance",
      "hot runner",
      "cavity pressure",
      "fill balance",
      "process capability",
    ],
    relatedTopics: [
      "injection-molding-gate-location",
      "injection-molding-cycle-time-optimization-guide",
    ],
    coreExplanation:
      "Cavity balance determines whether multiple cavities fill, pack and cool consistently enough to maintain production capability.",
    engineeringPrinciple:
      "A geometrically symmetric runner is not automatically rheologically balanced because polymer viscosity, shear heating and gate restrictions influence pressure loss.",
  },
};

function sentenceList(items: string[]): string {
  return items.map((item) => `${item}.`).join(" ");
}

function makeLongTailQueries(profile: TopicProfile): string[] {
  const queries = new Set<string>();

  queries.add(profile.title.toLowerCase());
  queries.add(`${profile.entity} design guide`);
  queries.add(`${profile.entity} DFM`);
  queries.add(`${profile.entity} best practices`);
  queries.add(`${profile.entity} design rules`);
  queries.add(`${profile.entity} engineering guide`);

  for (const modifier of profile.longTailModifiers) {
    queries.add(`${profile.entity} ${modifier}`);
  }

  for (const variable of profile.primaryVariables) {
    queries.add(`${profile.entity} ${variable}`);
    queries.add(`${variable} in ${profile.entity}`);
  }

  for (const failure of profile.failureModes) {
    queries.add(`${profile.entity} ${failure}`);
    queries.add(`how to prevent ${failure} in ${profile.entity}`);
  }

  return [...queries];
}

function buildFaq(profile: TopicProfile) {
  const faq = [
    {
      question: `What is the most important design variable for ${profile.entity}?`,
      answer:
        profile.primaryVariables[0] +
        " is a primary variable, but it should not be optimized independently. " +
        profile.engineeringPrinciple,
    },
    {
      question: `What are the most common problems associated with ${profile.entity}?`,
      answer:
        sentenceList(profile.failureModes.slice(0, 5)),
    },
    {
      question: `How should ${profile.entity} be reviewed during DFM?`,
      answer:
        `A DFM review should examine ${sentenceList(profile.primaryVariables.slice(0, 6))} together with tooling access, ejection and process capability.`,
    },
    {
      question: `Which manufacturing factors have the greatest influence?`,
      answer:
        sentenceList(profile.manufacturingFactors),
    },
    {
      question: `How should the design be validated before production tooling?`,
      answer:
        sentenceList(profile.validationMethods),
    },
  ];

  for (const modifier of profile.longTailModifiers.slice(0, 5)) {
    faq.push({
      question: `How does ${modifier} affect ${profile.entity}?`,
      answer:
        `${modifier} should be evaluated against the complete geometry, material and process window rather than treated as an isolated parameter.`,
    });
  }

  return faq;
}

function buildSections(profile: TopicProfile): WhitePaperSection[] {
  return [
    {
      id: "engineering-definition",
      heading: `1. What ${profile.entity} Actually Means`,
      paragraphs: [
        profile.coreExplanation,
        profile.engineeringPrinciple,
        `The engineering variables that should be considered together include ${sentenceList(
          profile.primaryVariables,
        )}`,
      ],
    },

    {
      id: "design-rules",
      heading: "2. Core Engineering Design Rules",
      paragraphs: [
        `The following rules provide a practical starting point for concept design and DFM review.`,
      ],
      bullets: profile.designRules,
    },

    {
      id: "variables",
      heading: "3. Critical Engineering Variables",
      paragraphs: [
        `No single parameter determines the final result. ${profile.entity} is a coupled system in which geometry, material, mold design and process conditions interact.`,
      ],
      table: {
        headers: ["Variable", "Why It Matters", "Typical Engineering Question"],
        rows: profile.primaryVariables.map((variable) => [
          variable,
          `Changes the behavior of the molded part, mold or process.`,
          `What happens if ${variable} changes?`,
        ]),
      },
    },

    {
      id: "failure-modes",
      heading: "4. Failure Modes and Root-Cause Analysis",
      paragraphs: [
        `A useful troubleshooting process begins by distinguishing design-driven causes from tooling-driven and process-driven causes.`,
      ],
      table: {
        headers: ["Failure Mode", "Typical Root-Cause Category", "Investigation Direction"],
        rows: profile.failureModes.map((failure) => [
          failure,
          "Geometry / Material / Tooling / Process",
          `Review ${failure} against geometry, material condition, mold design and process history.`,
        ]),
      },
    },

    {
      id: "manufacturing",
      heading: "5. Manufacturing and Tooling Considerations",
      paragraphs: [
        `The production result depends on how the part design interacts with the mold and molding process.`,
        `Important manufacturing factors include ${sentenceList(
          profile.manufacturingFactors,
        )}`,
      ],
      bullets: profile.manufacturingFactors,
    },

    {
      id: "dfm",
      heading: "6. DFM Review Framework",
      paragraphs: [
        `A professional DFM review should not stop at checking whether the geometry can technically be molded. It should determine whether the design can be molded repeatedly within an economically viable process window.`,
      ],
      bullets: [
        "Material selection and resin grade",
        "Nominal wall and local mass distribution",
        "Draft and ejection",
        "Parting-line strategy",
        "Gate and runner strategy",
        "Venting",
        "Cooling",
        "Shrinkage and dimensional tolerances",
        "Tool steel and surface requirements",
        "Production volume and expected tool life",
      ],
    },

    {
      id: "validation",
      heading: "7. Simulation, Prototype and Production Validation",
      paragraphs: [
        `Simulation should be used to reduce uncertainty before steel is committed, while physical validation confirms whether the selected design and process remain stable in manufacturing.`,
        `Recommended validation methods include ${sentenceList(
          profile.validationMethods,
        )}`,
      ],
      bullets: profile.validationMethods,
    },

    {
      id: "comparisons",
      heading: "8. Engineering Trade-Offs and Design Alternatives",
      paragraphs: [
        `The correct design is normally the one that provides the required function with the lowest combined manufacturing risk, tooling complexity and lifecycle cost.`,
      ],
      bullets: profile.comparisonTopics,
    },

    {
      id: "process-window",
      heading: "9. Process Window and Production Control",
      paragraphs: [
        `A design should be considered production-ready only when the interaction between geometry, material, tooling and process has been demonstrated to be stable.`,
        `Production control should monitor the variables that materially influence ${profile.entity}, rather than relying on a single machine setting or nominal parameter.`,
      ],
      bullets: [
        "Material condition",
        "Machine setup",
        "Mold temperature",
        "Injection profile",
        "Packing behavior",
        "Cooling behavior",
        "Part weight",
        "Critical dimensions",
        "Appearance",
        "Cavity-to-cavity variation where applicable",
      ],
    },

    {
      id: "engineering-checklist",
      heading: "10. Engineering Release Checklist",
      paragraphs: [
        `Before releasing the design to production tooling, verify the following items.`,
      ],
      bullets: [
        "Functional requirements are defined.",
        "Material grade is identified.",
        "Critical dimensions and tolerances are identified.",
        "DFM review is complete.",
        "Gate strategy is reviewed.",
        "Parting-line strategy is reviewed.",
        "Draft and ejection are verified.",
        "Cooling strategy is reviewed.",
        "Known failure modes have mitigation plans.",
        "Validation criteria are defined.",
        "Production capability requirements are defined.",
      ],
    },

    {
      id: "long-tail",
      heading: "11. Long-Tail Engineering Questions",
      paragraphs: [
        `The engineering questions below represent the practical search and decision space surrounding this topic. They should be answered through engineering reasoning rather than keyword repetition.`,
      ],
      bullets: makeLongTailQueries(profile),
    },

    {
      id: "conclusion",
      heading: "12. Engineering Conclusion",
      paragraphs: [
        profile.engineeringPrinciple,
        `For production molding, the strongest design is the one that remains understandable, manufacturable, inspectable and repeatable after the part leaves the design office and enters the mold, machine and quality system.`,
      ],
    },
  ];
}

export function buildWhitePaperV2(
  slug: string,
): WhitePaperDocument {
  const profile = TOPICS[slug];

  if (!profile) {
    throw new Error(
      `V714_WHITE_PAPER_TOPIC_NOT_FOUND:${slug}`,
    );
  }

  return {
    title: profile.title,
    description: profile.description,
    category: profile.category,
    slug: profile.slug,

    executiveSummary:
      `${profile.coreExplanation} ${profile.engineeringPrinciple}`,

    directAnswer:
      `${profile.coreExplanation} The correct engineering approach is to evaluate ${sentenceList(
        profile.primaryVariables,
      )} as a coupled system.`,

    keyTakeaways: [
      ...profile.designRules.slice(0, 5),
      `Primary failure modes include ${sentenceList(
        profile.failureModes.slice(0, 5),
      )}`,
      `Validation should include ${sentenceList(
        profile.validationMethods.slice(0, 4),
      )}`,
    ],

    sections: buildSections(profile),

    faq: buildFaq(profile),

    longTailQueries: makeLongTailQueries(profile),

    relatedTopics: profile.relatedTopics,
  };
}

export function getV714WhitePaperSlugs(): string[] {
  return Object.keys(TOPICS);
}

export function hasV714WhitePaperTopic(
  slug: string,
): boolean {
  return Boolean(TOPICS[slug]);
}