"use client";

import * as React from "react";
import { Bar, BarChart, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type StatusDatum = { name: string; count: number };
type PriorityDatum = { priority: string; count: number };

// Recharts reads colors from CSS variables defined in globals.css.
const STATUS_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "var(--chart-2)",
  MEDIUM: "var(--chart-1)",
  HIGH: "var(--chart-4)",
  URGENT: "var(--chart-5)",
};

export function DashboardCharts({
  statusBreakdown,
  priorityBreakdown,
}: {
  statusBreakdown: StatusDatum[];
  priorityBreakdown: PriorityDatum[];
}) {
  const statusData = React.useMemo(
    () =>
      statusBreakdown
        .filter((d) => d.count > 0)
        .map((d, i) => ({ ...d, fill: STATUS_PALETTE[i % STATUS_PALETTE.length] })),
    [statusBreakdown],
  );

  const totalCards = React.useMemo(
    () => statusData.reduce((sum, d) => sum + d.count, 0),
    [statusData],
  );

  const statusConfig = React.useMemo(() => {
    const config: ChartConfig = { count: { label: "Cards" } };
    statusBreakdown.forEach((d, i) => {
      config[d.name] = {
        label: d.name,
        color: STATUS_PALETTE[i % STATUS_PALETTE.length],
      };
    });
    return config;
  }, [statusBreakdown]);

  const priorityData = React.useMemo(
    () =>
      priorityBreakdown.map((d) => ({
        priority: PRIORITY_LABELS[d.priority] ?? d.priority,
        count: d.count,
        fill: PRIORITY_COLORS[d.priority] ?? "var(--chart-1)",
      })),
    [priorityBreakdown],
  );

  const priorityConfig: ChartConfig = { count: { label: "Cards" } };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Cards by status</CardTitle>
          <CardDescription>Distribution across all board columns</CardDescription>
        </CardHeader>
        <CardContent>
          {totalCards === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={statusConfig}
              className="mx-auto aspect-square max-h-[260px]"
            >
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={4}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {totalCards.toLocaleString()}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 22}
                              className="fill-muted-foreground text-sm"
                            >
                              Cards
                            </tspan>
                          </text>
                        );
                      }
                      return null;
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {statusData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
                <span className="font-medium tabular-nums">{entry.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cards by priority</CardTitle>
          <CardDescription>How urgent the open work is</CardDescription>
        </CardHeader>
        <CardContent>
          {priorityData.every((d) => d.count === 0) ? (
            <EmptyChart />
          ) : (
            <ChartContainer config={priorityConfig} className="aspect-square max-h-[260px] w-full">
              <BarChart accessibilityLayer data={priorityData} margin={{ left: -10 }}>
                <XAxis
                  dataKey="priority"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.priority} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex aspect-square max-h-[260px] items-center justify-center text-sm text-muted-foreground">
      No cards yet
    </div>
  );
}
