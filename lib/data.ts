import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

export async function getProjects() {
  return prisma.project.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      columns: {
        select: { id: true },
      },
      _count: {
        select: { tasks: true },
      },
    },
  });
}

export async function getProjectBoard(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return project;
}
