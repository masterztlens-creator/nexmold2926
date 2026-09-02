/**
 * src/data/servicesData.ts
 * 全量工法数据库（包含全部 26 个工法 Slug，确保 getStaticPaths 生成所有页面）
 */

export interface ServiceSpoke {
  slug: string;
  title: string;
  tagline: string;
  category: string;
  leadTime: string;
  tolerance: string;
  idealVolume: string;
  equipment: string;
  heroBadge: string;
  heroImage: string;
  mechanismImage: string;
  overview: string;
  keyStats: Array<{ label: string; val: string; sub?: string }>;
  trustSignals: Array<{ num: string; label: string; sub?: string }>;
  dfmSpecs: Array<{ label: string; min: string; rec: string; max: string; note: string }>;
  materials: Array<{ name: string; grade: string; type: string; density: string; prop: string }>;
  applications: Array<{ name: string; desc: string; img: string }>;
  productionSteps: Array<{ phase: string; title: string; desc: string; icon?: string }>;
  comparisonTable?: Array<{ metric: string; advanced: string; standard: string }>;
  faq: Array<{ q: string; a: string }>;
}

const defaultStats = [
  { label: "Fleet Range", val: "90T - 1200T", sub: "Haitian servo presses" },
  { label: "Scrap Target", val: "< 0.8%", sub: "Automated robotic cells" },
  { label: "Tolerance Standard", val: "DIN 16742", sub: "Scientific process" },
  { label: "Lead Time (T1)", val: "10 - 15 Days", sub: "Fast sampling" }
];

const defaultTrust = [
  { num: "30+", label: "Haitian Presses", sub: "In-house Dongguan facility" },
  { num: "99.2%", label: "First-Pass Yield", sub: "Decoupled validation" },
  { num: "10,000m²", label: "Plant Floor", sub: "ISO 9001:2015 audited" },
  { num: "24h", label: "DFM & Pricing", sub: "Direct factory engineers" }
];

const defaultDfm = [
  { label: "Nominal Wall Thickness", min: "0.8 mm", rec: "1.5 - 3.0 mm", max: "6.0 mm", note: "Uniform wall avoids uneven cooling and structural sink depressions." },
  { label: "Draft Angle (Core & Cavity)", min: "0.5°", rec: "1.0° - 1.5°", max: "3.0°", note: "Adequate draft enables rapid part ejection without scuff marks." },
  { label: "Rib-to-Wall Ratio", min: "40%", rec: "50% - 60%", max: "70%", note: "Keep rib base below 60% of base wall to avoid cosmetic sink marks." },
  { label: "Corner Radius (R)", min: "R 0.5 mm", rec: "0.5x - 0.75x Wall", max: "R 5.0 mm", note: "Radiused corners eliminate stress concentrations and improve flow." }
];

const defaultMaterials = [
  { name: "Chimei Polylac ABS", grade: "PA-757", type: "Styrenic", density: "1.05 g/cm³", prop: "High impact consumer and appliance enclosures" },
  { name: "Covestro Makrolon PC", grade: "2805", type: "Polycarbonate", density: "1.20 g/cm³", prop: "Optical transparency & heat resistance" },
  { name: "LyondellBasell PP", grade: "Purell HP570M", type: "Polypropylene", density: "0.91 g/cm³", prop: "Living hinges & high fluid resistance" },
  { name: "DuPont Zytel PA66+GF30", grade: "70G33L", type: "Polyamide", density: "1.37 g/cm³", prop: "High tensile mechanical frames" }
];

const defaultApps = [
  { name: "Countertop Water Reservoirs", desc: "Leak-proof ultrasonic welded transparent tanks", img: "/images/services/dfm-cad-analysis.webp" },
  { name: "Appliance Front Bezels", desc: "Class-A cosmetic finish with zero sink marks", img: "/images/services/automated-haitian-injection-molding-fleet.webp" },
  { name: "Industrial Electrical Housings", desc: "Flame retardant UL94 V-0 enclosures", img: "/images/services/precision-mold-tooling-cnc-machining.webp" },
  { name: "Child Safety Seat Buckles", desc: "Structural load-bearing engineered components", img: "/images/services/2k-two-shot-overmolding-insert-structure.webp" }
];

const defaultFaq = [
  { q: "What is your standard production mold guarantee?", a: "We guarantee lifetime tool maintenance and cavity replacement for all production molds running in our Dongguan facility." },
  { q: "Can you provide material traceability certificates?", a: "Yes. Every shipment includes genuine polymer manufacturer Certificates of Analysis (CoA) and lot inspection sheets." }
];

const defaultComparison = [
  { metric: "Process Window Control", advanced: "Decoupled scientific parameter lock-in", standard: "Manual trial-and-error operator tuning" },
  { metric: "Dimensional Capability (CpK)", advanced: "CpK ≥ 1.67 across critical features", standard: "CpK < 1.0 with wide batch variations" },
  { metric: "Scrap & Regrind Ratio", advanced: "< 0.8% virgin polymer scrap", standard: "5% - 10% scrap with heavy regrind blending" }
];

const slugsList = [
  { slug: "custom-injection-molding", title: "Custom Plastic Injection Molding", cat: "Core & Advanced Molding", tag: "High-Yield Multi-Cavity Tooling & Turnkey Production" },
  { slug: "liquid-silicone", title: "Liquid Silicone Rubber (LSR) Molding", cat: "Core & Advanced Molding", tag: "Medical-Grade & High-Purity Platinum-Cured Elastomers" },
  { slug: "overmolding", title: "Overmolding & Two-Shot (2K) Molding", cat: "Core & Advanced Molding", tag: "Permanent Chemical Bonding Multi-Material Tech" },
  { slug: "insert-molding", title: "Insert & Encapsulation Molding", cat: "Core & Advanced Molding", tag: "High-Torque Bushing & Stamped Leadframe Encapsulation" },
  { slug: "mucell-foaming", title: "MuCell® Microcellular Foaming", cat: "Core & Advanced Molding", tag: "Supercritical Fluid (N2/CO2) Micro-Foaming Technology" },
  { slug: "iml-imd", title: "In-Mold Labeling (IML) & IMD", cat: "Core & Advanced Molding", tag: "Permanent High-Definition Graphics & Scratch Resistance" },
  { slug: "gas-water-assist", title: "Gas & Water-Assist Injection Molding", cat: "Core & Advanced Molding", tag: "Hollow Structural Channels & Sink-Free Geometries" },
  { slug: "cleanroom-molding", title: "ISO 13485 Cleanroom Molding", cat: "Core & Advanced Molding", tag: "Medical-Grade Biocompatible & Particulate-Free Manufacturing" },
  { slug: "rapid-tooling", title: "Quick-Turn Rapid Prototype Tooling", cat: "Tooling & Mold Structures", tag: "7-14 Day Fast T1 Turnaround for Functional Verification" },
  { slug: "production-tooling", title: "Class 101 Production Steel Tooling", cat: "Tooling & Mold Structures", tag: "Hardened ASSAB S136 Tooling Guaranteed for 1M+ Shots" },
  { slug: "stack-molds", title: "Stack Molds (Double Volume Output)", cat: "Tooling & Mold Structures", tag: "2X Part Production Capacity Without Upgrading Press Tonnage" },
  { slug: "conformal-cooling", title: "Conformal Cooling & BeCu Tooling", cat: "Tooling & Mold Structures", tag: "Cut Cycle Time by 35% & Eliminate Part Warpage" },
  { slug: "unscrewing-molds", title: "Automatic Unscrewing Mold Tooling", cat: "Tooling & Mold Structures", tag: "High-Speed Hydraulic & Servo Threaded Cap Tooling" },
  { slug: "hot-runner", title: "Advanced Hot Runner Systems", cat: "Tooling & Mold Structures", tag: "Zero-Runner Waste Valve Gate Multi-Cavity Tooling" },
  { slug: "moldflow-analysis", title: "Advanced Moldflow Simulation", cat: "Tooling & Mold Structures", tag: "Predictive Fill, Pack, Cool & Warpage Analysis" },
  { slug: "cnc-milling", title: "Multi-Axis Precision CNC Milling", cat: "Precision Machining", tag: "Micron-Level 5-Axis High-Speed CNC Milling for Molds" },
  { slug: "cnc-turning", title: "Precision CNC Turning & Live Tooling", cat: "Precision Machining", tag: "Multi-Spindle Lathes with Live Tooling for Core Pins" },
  { slug: "edm-machining", title: "Wire EDM & Mirror Sink EDM", cat: "Precision Machining", tag: "Sub-Micron Spark Erosion for Intricate Tooling Geometries" },
  { slug: "deep-hole-drilling", title: "Deep Hole Gun Drilling for Waterlines", cat: "Precision Machining", tag: "Precision Straight Water Circuits for Large Molds" },
  { slug: "steel-cavities", title: "ASSAB S136 & NAK80 Cavity Machining", cat: "Precision Machining", tag: "Premium Tool Steel for High-Gloss & Corrosion Resistance" },
  { slug: "zeiss-cmm", title: "Zeiss CMM & 3D Scan Metrology", cat: "Quality & Post-Processing", tag: "100% Dimensional FAI Reports & Full GD&T Quality Inspection" },
  { slug: "scientific-molding", title: "Scientific Molding Process Validation", cat: "Quality & Post-Processing", tag: "Decoupled Molding Cavity Pressure & Viscosity Optimization" },
  { slug: "annealing", title: "Annealing & Stress Relief Treatment", cat: "Quality & Post-Processing", tag: "Thermal Stress Relief to Prevent Chemical Crazing & Warpage" },
  { slug: "emi-shielding", title: "EMI / RFI Shielding & Coatings", cat: "Quality & Post-Processing", tag: "Conductive Paint & Vacuum Metalizing for EMC Compliance" },
  { slug: "surface-finishing", title: "SPI High-Gloss & VDI Texturing", cat: "Quality & Post-Processing", tag: "SPI A-1 Diamond Polish, VDI 3400 & Mold-Tech Textures" },
  { slug: "assembly-fba", title: "Ultrasonic Welding & FBA Box-Build", cat: "Quality & Post-Processing", tag: "Hermetic Ultrasonic Welding & Amazon FBA Packaging" }
];

export const serviceSpokesData: Record<string, ServiceSpoke> = {};

slugsList.forEach(item => {
  serviceSpokesData[item.slug] = {
    slug: item.slug,
    title: item.title,
    tagline: item.tag,
    category: item.cat,
    leadTime: "10 - 15 Days",
    tolerance: "DIN 16742 TG4 / ±0.002 in.",
    idealVolume: "1,000 to 10,000,000+ Parts",
    equipment: "30+ Haitian Servo Presses (90T - 1200T)",
    heroBadge: "HAITIAN 90T - 1200T FLEET",
    heroImage: "/images/services/automated-haitian-injection-molding-fleet.webp",
    mechanismImage: "/images/services/dfm-cad-analysis.webp",
    overview: `Factory-direct ${item.title.toLowerCase()} engineered in our Dongguan plant. Operating Haitian 90T to 1200T presses with automated robotic part handling, we deliver high yield rates (<0.8% scrap) and fast T1 sampling.`,
    keyStats: defaultStats,
    trustSignals: defaultTrust,
    dfmSpecs: defaultDfm,
    materials: defaultMaterials,
    applications: defaultApps,
    comparisonTable: defaultComparison,
    productionSteps: [
      { phase: "PHASE 01", title: "24h DFM & Moldflow", desc: "Gate analysis and shrinkage modeling." },
      { phase: "PHASE 02", title: "CNC Tooling & Mirror EDM", desc: "Hardened tool steel machined on Makino centers." },
      { phase: "PHASE 03", title: "T1 Sampling & FAI Inspection", desc: "Decoupled parameter lock and CMM inspection." },
      { phase: "PHASE 04", title: "Mass Production & Export", desc: "Automated robotic cell runs and turnkey shipping." }
    ],
    faq: defaultFaq
  };
});