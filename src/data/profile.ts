// Single source of truth for the site's content.
// Edit this file (and src/content/work/*.md) to update the portfolio — no CMS needed.

export const profile = {
  name: 'Rajeev Sahu',
  role: 'Senior Backend Engineer',
  headline:
    'I build APIs, distributed systems and auth infrastructure in Node.js, Go and Python on AWS.',
  summary:
    'Backend engineer with Node.js and TypeScript (NestJS, Express, BullMQ) as my home stack, and Go and Python where the workload calls for them. I like the unglamorous parts of production: migrations that don’t drop data, rate limiters that hold under load, and identity systems that three products can share. Currently scaling a data-enrichment API platform at RichAPI.',
  // Shown as chips under the headline.
  focus: ['Node.js', 'TypeScript', 'NestJS', 'Go', 'Python', 'AWS'],
  location: 'Bengaluru, India',
  // Set to null to hide the availability badge.
  availability: 'Open to backend / SDE-2 roles · from 1 Dec 2026',
  email: 'irajeevsahu@gmail.com',
  resume: '/resume.pdf',
  // File name visitors get when they click "Download resume".
  resumeFileName: 'Rajeev-Sahu-Resume.pdf',
  links: {
    github: 'https://github.com/irajeevsahu',
    linkedin: 'https://www.linkedin.com/in/irajeevsahu',
  },
  site: 'https://rajeevsahu.me',
};

export const metrics = [
  { value: '30%', label: 'lower latency after the NestJS → Go migration' },
  { value: '2×', label: 'throughput on the same three applications' },
  { value: '150–300', label: 'req/s sustained on a FastAPI platform' },
  { value: '~$40K', label: 'yearly AWS spend cut (−30%)' },
  { value: '99.9%', label: 'uptime SLA across three enterprise apps' },
  { value: '13', label: 'upstream providers behind one failover waterfall' },
];

export type Job = {
  company: string;
  note?: string;
  role: string;
  period: string;
  location: string;
  points: string[];
  stack: string[];
};

export const experience: Job[] = [
  {
    company: 'RichAPI',
    note: 'previously TexAu',
    role: 'Senior Backend Developer',
    period: 'Jun 2026 — Present',
    location: 'Bengaluru',
    points: [
      'Scale a Python/FastAPI data-enrichment platform (~80 REST endpoints) on ECS Fargate, PostgreSQL and Redis at 150–300 req/s with async I/O and response caching.',
      'Migrated the primary datastore from DynamoDB to PostgreSQL (Supabase) via a dual-write rollout; modelled credit allocation, org-level pricing, usage reporting and retention.',
      'Designed an OIDC-compatible identity layer shared by three products, with org/team-level RBAC, and an MCP server with an OAuth-to-API-key credential bridge.',
      'Built a two-layer Redis token-bucket rate limiter (atomic Lua) and a provider ledger tracking health and cost across a 13-provider failover.',
      'Shipped a FastAPI + Celery email-verification service and provisioned the scraping stack (ECS, ALB, Redis) with Terraform.',
    ],
    stack: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Celery', 'AWS ECS', 'Terraform'],
  },
  {
    company: 'TexAu',
    role: 'Backend Developer',
    period: 'Jun 2024 — May 2026',
    location: 'Bengaluru',
    points: [
      'Built and maintained REST APIs and background services in Node.js / NestJS (TypeScript) for the V2 and V3 platforms — tables, waterfall enrichment groups with credit-cost estimation, roles and permissions, outgoing webhooks, billing and credit-note APIs.',
      'Migrated Redis-backed job queues from Bull to BullMQ, added per-user API rate limiting, and integrated Google OAuth with Google Sheets export; modelled data with Prisma and MongoDB.',
      'Led the NestJS → Go migration across three enterprise applications: 30% lower latency, 40% less memory, 2× throughput.',
      'Built Go (Gin) services on a RabbitMQ-driven DAG workflow engine — real-time SSE updates, plan-based fair scheduling and concurrency limits, fault-tolerant reconnection, enrichment caching.',
      'Published TexAu’s n8n community node (Node.js / TypeScript), cutting manual process runtime by 40%.',
      'Ran AWS infrastructure (EC2, S3, Lambda, SQS) at a 99.9% uptime SLA and cut cloud spend 30% (~$40K/yr); implemented GDPR soft-delete with audit trails and wrote SOC 2 Type II documentation.',
    ],
    stack: ['Node.js', 'NestJS', 'TypeScript', 'BullMQ', 'Prisma', 'Go', 'Gin', 'RabbitMQ', 'MongoDB', 'AWS'],
  },
  {
    company: 'GoComet',
    role: 'Backend Developer',
    period: 'Jun 2023 — May 2024',
    location: 'Bengaluru',
    points: [
      'Led a team of 5 interns redesigning invoice-comparison algorithms: +25% accuracy, +35% throughput.',
      'Replaced hard-coded configuration with database-driven components, making deploys 35% faster.',
      'Built bulk Excel upload with value mapping, cutting data-entry errors from 8% to 3.2%.',
      'Integrated the JIRA REST API to give stakeholders real-time board metrics.',
    ],
    stack: ['JIRA REST API', 'Excel import'],
  },
  {
    company: 'Daffodil Health',
    role: 'Full Stack Developer Intern',
    period: 'May 2022 — May 2023',
    location: 'Bengaluru',
    points: [
      'Built and scaled Node.js backend services for a clinical management platform from 500 to 10,000+ concurrent users with HAProxy load balancing, Redis caching and query tuning.',
      'Set up CI/CD on GitHub Actions + EC2, taking deploys from 30 minutes to 5.',
      'Integrated Zoho CRM, Wix and Interakt WhatsApp APIs into the Node.js services, removing 20+ manual data-entry tasks.',
    ],
    stack: ['Node.js', 'HAProxy', 'Redis', 'GitHub Actions', 'AWS EC2'],
  },
];

export type Project = {
  name: string;
  description: string;
  stack: string[];
  href: string;
};

export const projects: Project[] = [
  {
    name: 'n8n-nodes-texau',
    description:
      'A published n8n community node that exposes TexAu automations inside n8n workflows, with its own credential type. Cut manual process runtime by 40% for internal automation.',
    stack: ['Node.js', 'TypeScript', 'n8n', 'npm'],
    href: 'https://www.npmjs.com/package/@texau/n8n-nodes-texau',
  },
  {
    name: 'GKV Attendance',
    description:
      'Geofenced attendance for my university. Teachers start a class at a location; students check in from the mobile app and the backend verifies they are inside the radius. Background jobs on BullMQ.',
    stack: ['NestJS', 'MongoDB', 'Redis', 'BullMQ', 'Expo'],
    href: 'https://github.com/irajeevsahu/gkv-app',
  },
  {
    name: 'Session Booking API',
    description:
      'Teachers publish sessions, users book them. Booking and completion are single atomic updates, so a session can never be double-booked under concurrent requests. Zod validation and aggregation pipelines.',
    stack: ['TypeScript', 'Express 5', 'MongoDB', 'Zod'],
    href: 'https://github.com/irajeevsahu/session-booking-api',
  },
];

export const skills: { group: string; items: string[] }[] = [
  { group: 'Node.js', items: ['TypeScript', 'JavaScript (ES6+)', 'NestJS', 'Express', 'BullMQ', 'Prisma', 'n8n nodes'] },
  { group: 'Languages', items: ['TypeScript', 'Go', 'Python', 'SQL'] },
  { group: 'Backend', items: ['NestJS', 'Gin', 'FastAPI', 'Celery', 'REST', 'Webhooks', 'SSE'] },
  { group: 'Data', items: ['PostgreSQL', 'MongoDB', 'Redis', 'DynamoDB', 'RabbitMQ', 'SQS', 'BullMQ'] },
  { group: 'Infra', items: ['AWS (ECS, Lambda, EC2, S3, ALB)', 'Terraform', 'Docker', 'GitHub Actions', 'Cloudflare'] },
  { group: 'Auth & security', items: ['OIDC', 'OAuth 2.0', 'RBAC', 'Rate limiting', 'GDPR', 'SOC 2'] },
];

export const education = {
  degree: 'B.Tech, Computer Science & Engineering',
  school: 'Gurukula Kangri Vishwavidyalaya',
  period: '2019 — 2023',
};
