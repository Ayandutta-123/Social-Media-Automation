// ==========================================
// HyperThings - TypeScript Type Definitions
// ==========================================

export type ContentStatus = "Draft" | "Approved" | "Published" | "Rejected";
export type PostType = "competitor" | "industry";
export type Platform = "Instagram" | "LinkedIn" | "Instagram + LinkedIn";
export type WorkflowDay = "Sunday" | "Tuesday" | "Thursday";
export type WorkflowStatus = "Success" | "Failed" | "Running";
export type CompetitorPlatform = "Instagram" | "LinkedIn";

export interface ContentItem {
  id: string;
  title: string;
  body: string;
  status: ContentStatus;
  platform: Platform;
  scheduledDay: WorkflowDay;
  scheduledAt: string;
  imageUrl?: string;
  instagramCaption?: string;
  linkedinPost?: string;
  postType?: PostType;
  n8nExecutionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Competitor {
  id: string;
  name: string;
  platform: CompetitorPlatform;
  handleOrUrl: string;
  status: "Active" | "Paused";
  lastScraped?: string;
  postsTracked: number;
}

export interface Industry {
  id: string;
  name: string;
  isActive: boolean;
  rotationOrder: number;
  lastUsed?: string;
  postsGenerated: number;
}

export interface WorkflowRun {
  id: string;
  name: string;
  triggerType: "Manual" | "Scheduled";
  status: WorkflowStatus;
  startedAt: string;
  completedAt?: string;
  duration?: string;
  postsGenerated: number;
  errors: number;
}

export interface StatCard {
  label: string;
  value: string | number;
  subLabel: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}
