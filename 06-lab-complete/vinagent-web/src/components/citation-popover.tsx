"use client";

import type { Citation } from "@/lib/citations";
import { getCitationLabel } from "@/lib/citations";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function CitationRef({
  id,
  citation,
}: {
  id: number;
  citation?: Citation;
}) {
  if (!citation) {
    // Citation ID not in store — show plain superscript, no popover
    return (
      <sup className="text-[10px] text-muted-foreground/60 ml-0.5 font-mono select-none">
        [{id}]
      </sup>
    );
  }

  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary px-1 text-[10px] font-bold text-white transition-colors hover:bg-primary/80 align-super ml-0.5 cursor-pointer">
        {id}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden border-primary/30 shadow-xl" side="top" align="center">
        <div className="bg-primary text-white p-4 rounded-[inherit]">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-white/40 text-white text-[10px] leading-normal font-semibold bg-white/10"
            >
              {getCitationLabel(citation.type)}
            </Badge>
            <span className="font-mono text-[10px] text-white/60">
              {citation.timestamp}
            </span>
          </div>
          <p className="text-sm font-bold text-white leading-normal">{citation.title}</p>
          <p className="mt-1.5 text-xs text-white/85 leading-relaxed">
            {citation.detail}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-primary uppercase tracking-wide">
        Nguồn tham khảo
      </h4>
      {citations.map((c) => (
        <div
          key={c.id}
          className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-bold text-white">
            {c.id}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className="text-[10px] leading-normal border-primary/30 text-primary font-semibold"
              >
                {getCitationLabel(c.type)}
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground">
                {c.timestamp}
              </span>
            </div>
            <p className="text-sm font-bold text-primary leading-normal">{c.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              {c.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
