import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const outreach = await prisma.outreach.findMany({
    include: { job: { select: { title: true, company: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(outreach);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const outreach = await prisma.outreach.create({
    data: {
      jobId: body.jobId || null,
      company: body.company || "",
      recruiterName: body.recruiterName || "",
      recruiterEmail: body.recruiterEmail || "",
      subject: body.subject || "",
      body: body.body || "",
      status: "draft",
    },
  });
  return NextResponse.json(outreach);
}
