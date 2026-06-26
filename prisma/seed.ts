import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Ensure the singleton settings row exists.
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  // Create a starter profile only if none exist, so re-seeding is safe.
  const count = await prisma.profile.count();
  if (count === 0) {
    await prisma.profile.create({
      data: {
        name: "My Profile",
        email: "",
        headline: "Software Engineer",
        isActive: true,
        targetRoles: JSON.stringify(["Software Engineer", "Frontend Engineer"]),
        targetCompanies: JSON.stringify([]),
        preferences: JSON.stringify({
          remote: true,
          locations: [],
          minSalary: 0,
          seniority: "mid",
          mustHave: [],
          avoid: [],
        }),
        baseResume: STARTER_RESUME,
      },
    });
    console.log("✔ Created starter profile 'My Profile'.");
  } else {
    console.log("• Profiles already exist — skipping starter profile.");
  }

  console.log("✔ Seed complete.");
}

const STARTER_RESUME = `# Jane Doe
Software Engineer • jane@example.com • (555) 123-4567 • San Francisco, CA
linkedin.com/in/janedoe • github.com/janedoe

## Summary
Software engineer with 4+ years building web applications. Replace this with your
own summary, experience, skills, and education — this is a placeholder so you can
see how tailoring works. Use Markdown headings (##) for sections.

## Experience
**Senior Software Engineer — Acme Corp** (2022 – Present)
- Built and shipped customer-facing features used by 100k+ users.
- Led migration to TypeScript, reducing runtime errors by 30%.

**Software Engineer — Startup Inc** (2020 – 2022)
- Developed REST APIs and React frontends.
- Improved page load performance by 45%.

## Skills
JavaScript, TypeScript, React, Node.js, SQL, AWS, Docker

## Education
B.S. Computer Science — State University (2020)
`;

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
