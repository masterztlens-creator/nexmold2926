// src/data/navigationData.ts
/**
 * NavigationData.ts - NEXMOLD 全球 Top 1 工业独立站知识图谱级导航数据结构
 * 完全覆盖 SEO 长尾关键词、AI Search (GEO/LLM) 实体集群与全品类模具注塑知识库
 */

export interface NavItem {
  name: string;
  href: string;
  badge?: string;
  desc?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface MegaMenuData {
  key: string;
  name: string;
  href: string;
  columns: NavSection[];
  callout: {
    badge: string;
    title: string;
    description: string;
    image: string;
    linkText: string;
    linkHref: string;
  };
}

export const navigationData: Record<string, MegaMenuData> = {
  products: {
    key: 'products',
    name: 'Products',
    href: '/products',
    columns: [
      {
        title: 'Injection Molding Services',
        items: [
          { name: 'Custom Injection Molding', href: '/services/custom-injection-molding', desc: 'High-precision end-use parts' },
          { name: 'Precision Injection Molding', href: '/services/precision-injection-molding', desc: 'Tight tolerances up to ±0.01mm' },
          { name: 'Micro Injection Molding', href: '/services/micro-molding', desc: 'For ultra-small micro components' },
          { name: 'Large Part Injection Molding', href: '/services/large-part-molding', desc: 'Up to 1200T Haitian press fleet' },
          { name: 'Thin Wall Injection Molding', href: '/services/thin-wall-molding', desc: 'High-speed packaging & electronics' },
          { name: 'Gas-Assist & Water-Assist', href: '/services/gas-assist-molding', desc: 'Hollow structures & sink prevention' },
          { name: 'Insert & Encapsulation Molding', href: '/services/insert-molding', desc: 'Molding over metal inserts' },
          { name: 'Overmolding & Two-Shot (2K)', href: '/services/overmolding', desc: 'Multi-material tactile grips' }
        ]
      },
      {
        title: 'Specialty Molding & Silicone',
        items: [
          { name: 'Liquid Silicone Rubber (LSR)', href: '/services/liquid-silicone', desc: 'Biocompatible & heat-resistant' },
          { name: 'Compression & Thermoset', href: '/services/compression-molding', desc: 'Bakelite and high-temp resins' },
          { name: 'Medical Cleanroom Molding', href: '/services/cleanroom-molding', desc: 'ISO 13485 sterile production' },
          { name: 'Optical Plastic Molding', href: '/services/optical-molding', desc: 'PMMA/PC high clarity lenses' },
          { name: 'High-Temperature Molding', href: '/services/high-temp-molding', desc: 'PEEK and Ultem specialized runs' },
          { name: 'Food Grade & FDA Compliant', href: '/services/food-grade-molding', desc: 'Safe for food contact appliances' },
          { name: 'Transparent Plastic Molding', href: '/services/transparent-molding', desc: 'Zero-defect clear enclosures' },
          { name: 'High Cavitation Molding', href: '/services/high-cavitation', desc: 'High volume cost optimization' }
        ]
      },
      {
        title: 'Tooling & Mold Making',
        items: [
          { name: 'Rapid Prototype Tooling', href: '/services/rapid-tooling', badge: '7-14 DAYS', desc: 'Fast T1 samples' },
          { name: 'Class 101 Production Tooling', href: '/services/production-tooling', desc: '1M+ guaranteed shot life' },
          { name: 'Bridge Tooling Solutions', href: '/services/bridge-tooling', desc: 'Scalable intermediate production' },
          { name: 'Stack Molds & Multi-Level', href: '/services/stack-molds', desc: 'Double output per cycle' },
          { name: 'Hot Runner & Cold Runner', href: '/services/hot-runner-molds', desc: 'Optimized gating systems' },
          { name: 'Unscrewing Molds', href: '/services/unscrewing-molds', desc: 'For internal threaded parts' },
          { name: 'Conformal Cooling Molds', href: '/services/conformal-cooling', desc: '3D printed cooling channels' },
          { name: 'ASSAB S136 & NAK80 Steels', href: '/services/steel-cavities', desc: 'Imported mirror-finish steels' }
        ]
      },
      {
        title: 'Precision Machining & Assembly',
        items: [
          { name: 'Multi-Axis CNC Milling', href: '/services/cnc-milling', desc: 'High-speed metal & plastic machining' },
          { name: 'Precision CNC Turning', href: '/services/cnc-turning', desc: 'Cylindrical precision components' },
          { name: 'Wire EDM & Mirror Sink EDM', href: '/services/edm-machining', desc: 'Complex sharp internal corners' },
          { name: 'Zeiss CMM 3D Metrology', href: '/services/zeiss-cmm', desc: 'Full dimensional FAI reports' },
          { name: 'SPI High-Gloss & VDI Textures', href: '/services/surface-finishing', desc: 'A1-D3 polishing & texturing' },
          { name: 'Ultrasonic Welding & Staking', href: '/services/ultrasonic-welding', desc: 'Secure plastic sub-assembly' },
          { name: 'Turnkey FBA Packaging', href: '/services/assembly-fba', desc: 'Retail-ready Amazon box prep' }
        ]
      }
    ],
    callout: {
      badge: 'FACTORY_CAPACITY',
      title: 'Haitian Press Fleet (90T - 1200T)',
      description: 'Equipped with 30+ automated Haitian injection presses and high-speed in-house toolrooms for rapid T1 delivery.',
      image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80',
      linkText: 'Explore Full Capabilities →',
      linkHref: '/services'
    }
  },
  solutions: {
    key: 'solutions',
    name: 'Solutions',
    href: '/solutions',
    columns: [
      {
        title: 'Medical & Life Sciences',
        items: [
          { name: 'Medical Device Housings', href: '/industries/medical-devices', desc: 'ISO 13485 compliant casings' },
          { name: 'Surgical Trays & Cassettes', href: '/industries/surgical-trays', desc: 'Sterilizable instrument organizers' },
          { name: 'Microfluidic Cartridges', href: '/industries/diagnostic-cartridges', desc: 'High precision lab-on-a-chip' },
          { name: 'USP Class VI Biocomp Parts', href: '/industries/usp-class-vi', desc: 'Implantable & contact grade' }
        ]
      },
      {
        title: 'Automotive & EV Mobility',
        items: [
          { name: 'EV Battery Busbar Insulators', href: '/industries/ev-powertrain', desc: 'High-voltage flame retardant' },
          { name: 'Under-Hood UL94-V0 Parts', href: '/industries/under-hood', desc: 'High temp engine compartment' },
          { name: 'Automotive Lighting Lenses', href: '/industries/lighting-lenses', desc: 'Optical grade PMMA/PC' },
          { name: 'Structural EV Enclosures', href: '/industries/structural-covers', desc: 'Lightweight structural housing' }
        ]
      },
      {
        title: 'Consumer & AgTech',
        items: [
          { name: 'AgTech Hydroponic Modules', href: '/industries/agtech-hydroponics', desc: 'UV-stabilized anti-leak tanks' },
          { name: 'Countertop Appliance Parts', href: '/industries/countertop-appliances', desc: 'ICE maker & coffee machine components' },
          { name: 'Smart IoT Device Housings', href: '/industries/iot-devices', desc: 'Consumer electronics enclosures' },
          { name: 'Wearable Device Parts', href: '/industries/wearables', desc: 'Skin-friendly soft overmolding' }
        ]
      },
      {
        title: 'Industrial & Energy',
        items: [
          { name: 'Industrial Equipment Housings', href: '/industries/industrial-equipment', desc: 'Heavy-duty rugged shells' },
          { name: 'Power Tools & Handhelds', href: '/industries/power-tools', desc: 'Ergonomic dual-durometer grips' },
          { name: 'Renewable Energy Components', href: '/industries/renewable-energy', desc: 'Solar & wind farm hardware' },
          { name: 'Aerospace & Defense Parts', href: '/industries/aerospace', desc: 'Traceable high-spec molding' }
        ]
      }
    ],
    callout: {
      badge: 'INDUSTRY_EXPERTISE',
      title: '99.2% Verified Yield Rate',
      description: 'Delivering robust engineering solutions tailored to stringent international regulatory and performance benchmarks.',
      image: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
      linkText: 'Explore Industry Hub →',
      linkHref: '/solutions'
    }
  },
  materials: {
    key: 'materials',
    name: 'Materials',
    href: '/materials',
    columns: [
      {
        title: 'Engineering Thermoplastics',
        items: [
          { name: 'ABS & ABS/PC Blends', href: '/materials/abs', desc: 'General purpose sturdy housing' },
          { name: 'Polycarbonate (PC) Optical', href: '/materials/polycarbonate', desc: 'High impact & transparency' },
          { name: 'Nylon 66 (PA66 + 30%GF)', href: '/materials/nylon', desc: 'High mechanical rigidity' },
          { name: 'POM (Acetal / Delrin)', href: '/materials/pom', desc: 'Low friction precision gears' },
          { name: 'PMMA (Acrylic)', href: '/materials/pmma', desc: 'Light guides and transparent covers' },
          { name: 'Polypropylene (PP) & HDPE', href: '/materials/pp', desc: 'Chemical resistant containers' }
        ]
      },
      {
        title: 'High-Temp & Specialty Resins',
        items: [
          { name: 'PEEK (Medical / EV)', href: '/materials/peek', desc: 'Extreme temperature & strength' },
          { name: 'Ultem PEI (UL94-V0)', href: '/materials/ultem-pei', desc: 'Inherently flame retardant' },
          { name: 'PPS & PSU Resins', href: '/materials/pps', desc: 'High chemical & heat resistance' },
          { name: 'TPU & TPE Elastomers', href: '/materials/tpu', desc: 'Flexible rubber-like overmolds' },
          { name: 'PVDF Fluoropolymers', href: '/materials/pvdf', desc: 'Severe chemical environments' }
        ]
      },
      {
        title: 'Tooling Steels & Guides',
        items: [
          { name: 'ASSAB S136 Mirror Stainless', href: '/materials/s136-steel', desc: 'Corrosion resistant cavity steel' },
          { name: 'NAK80 Pre-Hardened Steel', href: '/materials/nak80-steel', desc: 'Superior polishability & texture' },
          { name: 'H13 & P20 Tool Steels', href: '/materials/h13-p20', desc: 'High volume production bases' },
          { name: 'Material Data Sheets (PDF)', href: '/materials/data-sheets', badge: 'DOWNLOAD', desc: 'Complete mechanical properties' },
          { name: 'Chemical Resistance Chart', href: '/materials/chemical-resistance', desc: 'Resin compatibility guide' }
        ]
      }
    ],
    callout: {
      badge: 'MATERIAL_SCIENCE',
      title: 'Expert Resin Selection',
      description: 'Access over 100+ certified engineering thermoplastics and custom compounding options for your exact specification.',
      image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80',
      linkText: 'Browse Material Database →',
      linkHref: '/materials'
    }
  },
  resources: {
    key: 'resources',
    name: 'Resources',
    href: '/knowledge-hub',
    columns: [
      {
        title: 'Engineering Calculators',
        items: [
          { name: 'Resin Shrinkage Calculator', href: '/knowledge-hub/calculators/shrinkage-calculator', badge: 'TOOL', desc: 'Predict post-molding dimensions' },
          { name: 'Wall Thickness & Draft Tool', href: '/knowledge-hub/calculators/wall-thickness', desc: 'Evaluate uniform cooling' },
          { name: 'Tooling Cost Estimator', href: '/knowledge-hub/calculators/cost-guide', desc: 'Instant budget forecasting' },
          { name: 'Clamp Tonnage Calculator', href: '/knowledge-hub/calculators/clamp-force', desc: 'Press size requirement sizing' }
        ]
      },
      {
        title: 'Design Guides & DFM',
        items: [
          { name: 'Rib, Boss & Draft Standards', href: '/knowledge-hub/dfm-guidelines', desc: 'Prevent sink marks & warping' },
          { name: 'ISO 2768-m Tolerance Chart', href: '/knowledge-hub/iso-tolerances', desc: 'Standard machining tolerances' },
          { name: 'Gate Location Best Practices', href: '/knowledge-hub/gate-location', desc: 'Optimize melt flow lines' },
          { name: 'Molding Glossary & Dictionary', href: '/knowledge-hub/glossary', desc: '800+ indexed industry terms' }
        ]
      },
      {
        title: 'Insights & Technical Hub',
        items: [
          { name: 'Technical FAQ Hub (800+ Q&A)', href: '/knowledge-hub/faq', desc: 'Direct answers to molding queries' },
          { name: 'Case Studies & Whitepapers', href: '/knowledge-hub/case-studies', desc: 'Real-world project breakdowns' },
          { name: 'S136 vs. NAK80 Whitepaper', href: '/knowledge-hub/steel-comparison', desc: 'In-depth steel performance study' },
          { name: 'Part Yield Optimization Guide', href: '/knowledge-hub/yield-optimization', desc: 'Maximize manufacturing efficiency' }
        ]
      }
    ],
    callout: {
      badge: 'KNOWLEDGE_ENGINE',
      title: 'Free Expert DFM Audit',
      description: 'Upload your 3D CAD files for an automated wall thickness, draft angle, and gate location analysis within 24 hours.',
      image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80',
      linkText: 'Request Free DFM Review →',
      linkHref: '#rfq'
    }
  },
  company: {
    key: 'company',
    name: 'Company',
    href: '/company',
    columns: [
      {
        title: 'About Nxmold',
        items: [
          { name: 'About Our Facility', href: '/company/about', desc: 'Export-oriented precision manufacturer' },
          { name: '30+ Haitian Press Floor', href: '/company/factory-floor', desc: '90T to 1200T automated machines' },
          { name: 'Dedicated Toolroom & CNC', href: '/company/toolroom', desc: 'High-speed in-house mold making' },
          { name: '10,000m² Dongguan Plant', href: '/company/dongguan-plant', desc: 'State-of-the-art production floor' }
        ]
      },
      {
        title: 'Quality & Certifications',
        items: [
          { name: 'Zeiss CMM Metrology Center', href: '/company/quality-control', desc: 'Sub-micron scanning accuracy' },
          { name: 'ISO 9001:2015 & IATF 16949', href: '/company/certifications', desc: 'Internationally audited quality' },
          { name: 'Material Lot Traceability & CoC', href: '/company/traceability', desc: 'Full compliance documentation' },
          { name: 'Rigorous Multi-Stage QA', href: '/company/inspection-rig', desc: 'Zero-defect delivery standards' }
        ]
      },
      {
        title: 'Global Logistics',
        items: [
          { name: 'Yantian Port Ocean Freight', href: '/company/shipping-logistics', desc: 'Direct international shipping' },
          { name: 'Turnkey DDP to USA & Europe', href: '/company/ddp-customs', desc: 'Hassle-free customs clearance' },
          { name: 'Amazon FBA Box Assembly', href: '/company/fba-warehousing', desc: 'Direct-to-fulfillment prep' },
          { name: 'Priority Brokerage Support', href: '/company/customs-clearance', desc: 'Seamless border transit' }
        ]
      }
    ],
    callout: {
      badge: 'AUDITED_SUPPLIER',
      title: 'Schedule a Factory Audit',
      description: 'Connect with our engineering export team or request a virtual video tour of our Dongguan manufacturing plant.',
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
      linkText: 'Request Factory Audit →',
      linkHref: '#rfq'
    }
  }
};