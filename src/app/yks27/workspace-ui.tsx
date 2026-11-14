import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export function SummaryStrip({ items, label, className = "" }: { label: string; className?: string; items: { label: string; value: ReactNode; detail?: ReactNode; tone?: string; lead?: boolean }[] }) {
  return <dl aria-label={label} data-count={items.length} className={cn("yks-summary", className)} style={{ "--summary-columns": items.length } as CSSProperties}>
    {items.map(item => <div key={item.label} data-lead={item.lead || undefined}><dt>{item.label}</dt><dd data-tone={item.tone}>{item.value}</dd>{item.detail ? <p>{item.detail}</p> : null}</div>)}
  </dl>;
}

export function WorkspaceEmpty({ title, children, href, action }: { title: string; children: ReactNode; href?: string; action?: string }) {
  return <Empty><EmptyHeader><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{children}</EmptyDescription></EmptyHeader>{href ? <EmptyContent><Button asChild><Link href={href}>{action}</Link></Button></EmptyContent> : null}</Empty>;
}

export function ReportBreadcrumb({ current }: { current: string }) {
  return <Breadcrumb className="mb-4"><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><Link href="/yks27">YKS 2027</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbLink asChild><Link href="/yks27/tyt">TYT denemeleri</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{current}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>;
}
