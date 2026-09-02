// src/data/types.ts

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export interface DirectAnswer {
  question: string;
  answer: string;
  keyPoints: string[];
}

export interface ComparisonTable {
  title: string;
  description?: string;
  headers: string[];
  rows: string[][];
}

export interface DiagnosticIssue {
  cause: string;
  solution: string;
  riskLevel: RiskLevel;
}

export interface DiagnosticMatrix {
  title: string;
  description?: string;
  issues: DiagnosticIssue[];
}

export interface Specification {
  label: string;
  value: string;
}

export interface ContentBlock {
  heading: string;
  content: string; // 支持 HTML 字符串
  callout?: string; // 工业高亮提示
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface KnowledgeArticle {
  title: string;
  description: string;
  category: string;
  categorySlug: string; // 对应上级的 Pillar 页面，如 'dfm-tolerances'
  slug: string; // 当前文章 URL，如 'draft-angle'
  lastUpdated: string;
  
  directAnswer?: DirectAnswer;
  comparisonTable?: ComparisonTable;
  diagnosticMatrix?: DiagnosticMatrix;
  specifications?: Specification[];

  contentBlocks: ContentBlock[];
  faqs: FAQ[];
  relatedSlugs: string[]; 
}