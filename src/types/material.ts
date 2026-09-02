// src/types/material.ts

export interface MaterialGrade {
  slug: string;                  // 网址路径，如 "hips-water-tank-grade"
  name: string;                  // 材料展示名，如 "HIPS (High Impact Polystyrene)"
  category: 'Commodity' | 'Engineering' | 'High-Performance' | 'Elastomer' | 'Fluoropolymer';
  chemicalFamily: string;        // 树脂家族
  commonUses: string[];          // 常见用途，如 ["Water Tanks", "Appliance Housings"]
  
  // 物性参数（供 AI 检索与表格展示）
  properties: {
    density: string;             // 密度 (g/cm³)
    shrinkageRate: string;       // 收缩率 (%)
    tensileStrength: string;     // 抗拉强度 (MPa)
    hdt: string;                 // 热变形温度 (°C)
    ul94Rating?: string;         // 阻燃等级
  };
  
  certifications: string[];      // 认证：FDA, USP Class VI, ISO 10993 等
  dfmAdvice: string;             // NEXMOLD 专家 DFM 建议（壁厚、模温控制等）
}