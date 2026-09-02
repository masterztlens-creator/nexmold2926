/**
 * src/pages/sitemap.xml.ts
 * 👑 NEXMOLD 动态 XML 站点地图生成器 (SEO & GEO 抓取加速引擎)
 * 1. 架构定位：自动抓取全站核心页面、计算器、材料/行业实体及多语言网关，生成标准的 XML Sitemap
 */

import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const baseUrl = 'https://nexmold.pages.dev';

  // 1. 核心静态落地页与计算器
  const staticPages = [
    '',
    '/about',
    '/products',
    '/capabilities',
    '/resources',
    '/quality/zeiss-cmm-inspection',
    '/capabilities/rapid-tooling-s136',
    '/industries/medical-consumables',
    '/industries/ev-powertrain',
    '/materials/peek',
    '/materials/polycarbonate',
    '/materials/pom',
    '/materials/ultem',
    '/materials/nylon66',
    '/components/precision-gears',
    '/components/microfluidic-cartridges',
    '/resources/faq',
    '/resources/design-guides/wall-thickness',
    '/resources/design-guides/surface-finish',
    '/resources/calculators/shrinkage-calculator',
    '/resources/calculators/injection-mold-cost-estimator',
    '/resources/calculators/clamping-force-calculator',
    '/resources/calculators/draft-angle-calculator',
    '/resources/calculators/instant-dfm-checker',
    '/de',
    '/fr'
  ];

  // 2. pSEO 矩阵组合模拟数据（与 [material]/[industry]/[component].astro 保持一致）
  const materials = ['peek', 'polycarbonate', 'nylon66', 'pom', 'ultem', 'abs'];
  const industries = ['vertical-farming', 'medical-consumables', 'ev-powertrain', 'countertop-ice-makers', 'smart-home-security'];
  const components = [
    'custom-hydroponic-housing', 
    'precision-gears', 
    'custom-surgical-trays', 
    'high-tolerance-busbar-insulators', 
    'precision-valve-bodies', 
    'custom-anti-leak-water-tank', 
    'custom-sealed-access-covers', 
    'precision-microfluidic-cartridges', 
    'high-tolerance-fluidic-manifolds'
  ];

  const pSeoUrls: string[] = [];
  for (const m of materials) {
    for (const i of industries) {
      for (const c of components) {
        pSeoUrls.push(`/${m}/${i}/${c}`);
      }
    }
  }

  const allUrls = [...staticPages, ...pSeoUrls];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allUrls
    .map((url) => {
      return `
  <url>
    <loc>${baseUrl}${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${url === '' ? 'daily' : 'weekly'}</changefreq>
    <priority>${url === '' ? '1.0' : url.includes('calculators') ? '0.9' : '0.8'}</priority>
  </url>`;
    })
    .join('')}
</urlset>`;

  return new Response(sitemapXml.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};