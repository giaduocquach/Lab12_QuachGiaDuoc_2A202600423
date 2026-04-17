export type Citation = {
  id: number;
  type: "sis" | "regulation" | "prerequisite" | "community";
  title: string;
  detail: string;
  timestamp: string;
};

const TYPE_LABELS: Record<Citation["type"], string> = {
  sis: "Dữ liệu SIS",
  regulation: "Quy định học vụ",
  prerequisite: "Điều kiện tiên quyết",
  community: "Dữ liệu cộng đồng",
};

const TYPE_COLORS: Record<Citation["type"], string> = {
  sis: "bg-primary/10 text-primary border-primary/20",
  regulation: "bg-accent/10 text-accent border-accent/20",
  prerequisite: "bg-warning/10 text-warning border-warning/20",
  community: "bg-success/10 text-success border-success/20",
};

export function getCitationLabel(type: Citation["type"]) {
  return TYPE_LABELS[type];
}

export function getCitationColor(type: Citation["type"]) {
  return TYPE_COLORS[type];
}
