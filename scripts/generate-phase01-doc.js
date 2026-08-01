const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
    ImageRun, PageBreak, TableOfContents, LevelFormat, VerticalAlign,
    ExternalHyperlink, Header, Footer, PageNumber, NumberFormat, Bookmark
  } = require("docx");
  const fs = require("fs");
  
  const CRIMSON = "C9184A";
  const DARK = "1A1A2E";
  const GREY = "555555";
  
  function h1(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text, color: CRIMSON, bold: true })],
    });
  }
  function h2(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
      children: [new TextRun({ text, color: DARK, bold: true })],
    });
  }
  function body(text) {
    return new Paragraph({
      spacing: { after: 160, line: 300 },
      children: [new TextRun({ text, size: 22, color: "222222" })],
    });
  }
  function bullet(text, level = 0) {
    return new Paragraph({
      numbering: { reference: "main-bullets", level },
      spacing: { after: 90 },
      children: [new TextRun({ text, size: 22, color: "222222" })],
    });
  }
  function boldLead(lead, rest) {
    return new Paragraph({
      spacing: { after: 160, line: 300 },
      children: [
        new TextRun({ text: lead, bold: true, size: 22, color: DARK }),
        new TextRun({ text: rest, size: 22, color: "222222" }),
      ],
    });
  }
  function caption(text) {
    return new Paragraph({
      spacing: { before: 100, after: 300 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, italics: true, size: 19, color: GREY })],
    });
  }
  function imageParagraph(path, width, height) {
    const resolved = require("path").isAbsolute(path)
      ? path
      : require("path").join(__dirname, path);
    if (!fs.existsSync(resolved)) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: `[Image missing: ${path}]`,
            italics: true,
            size: 20,
            color: GREY,
          }),
        ],
      });
    }
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [
        new ImageRun({ type: "png", data: fs.readFileSync(resolved), transformation: { width, height } }),
      ],
    });
  }
  function linkParagraph(label, url) {
    return new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: label + ": ", bold: true, size: 22, color: DARK }),
        new ExternalHyperlink({
          link: url,
          children: [new TextRun({ text: url, size: 22, color: "1155CC", underline: {} })],
        }),
      ],
    });
  }
  function cellText(text, opts = {}) {
    return new TableCell({
      width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
      shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: !!opts.bold, color: opts.color || "222222", size: opts.size || 19 })],
        }),
      ],
    });
  }
  function headerRowCells(cells, widths) {
    return new TableRow({
      tableHeader: true,
      children: cells.map((c, i) => cellText(c, { width: widths[i], bold: true, color: "FFFFFF", shade: DARK, size: 19 })),
    });
  }
  function dataRowCells(cells, widths, alt) {
    return new TableRow({
      children: cells.map((c, i) => cellText(c, { width: widths[i], shade: alt ? "F7F7FA" : "FFFFFF" })),
    });
  }
  function fullTable(headers, rows, widths) {
    return new Table({
      width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        headerRowCells(headers, widths),
        ...rows.map((r, idx) => dataRowCells(r, widths, idx % 2 === 1)),
      ],
    });
  }
  
  // ============================================================
  // TITLE PAGE
  // ============================================================
  const titlePage = [
    new Paragraph({ spacing: { before: 1000 }, children: [] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DUOTHAN 6.0", size: 30, bold: true, color: CRIMSON })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Beyond Coding, Into Engineering Excellence.", size: 20, italics: true, color: GREY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "PHASE 01 · RECON", size: 22, bold: true, color: DARK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 500, after: 100 }, children: [new TextRun({ text: "RESILIA", size: 48, bold: true, color: DARK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "A Secure, Scalable Digital Banking Platform for Post-Crisis Recovery", size: 26, color: CRIMSON, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Project Blueprint Submission", size: 22, color: DARK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Problem Identification · Proposed Solution · System Architecture", size: 19, color: GREY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Wireframes · Functional & Non-Functional Requirements · Technology Stack", size: 19, color: GREY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1000, after: 40 }, children: [new TextRun({ text: "Team Name: [Insert Team Name]", size: 20, color: DARK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Team Members: [Insert Names]", size: 20, color: DARK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Submitted to: IEEE Student Branch of NSBM — Duothan 6.0", size: 20, color: DARK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Date: 22 July 2026", size: 20, color: DARK })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  
  // ============================================================
  // TOC
  // ============================================================
  const tocSection = [
    h1("Table of Contents"),
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  
  // ============================================================
  // 01 PROBLEM IDENTIFICATION
  // ============================================================
  const section01 = [
    h1("01. Problem Identification"),
    h2("1.1 Background"),
    body("The Super Malware Agent attack of 2065 disabled core banking systems, ATMs, digital payment platforms, and loan-processing systems simultaneously. Because the legacy banking infrastructure was built as a single, tightly-coupled system rather than a set of independently deployable services, one successful intrusion was enough to bring the entire financial sector to a stop at once. Customer data survived because of secure backups, but the operational systems that customers and businesses depend on every day did not."),
    h2("1.2 Core Problem Statement"),
    boldLead("Problem: ", "Millions of individuals and small businesses have lost access to essential digital financial services — account access, payments, transfers, and credit — because the banking sector's monolithic architecture had no way to isolate the attack, and no verified fallback for restoring trusted operations once the Master Key was compromised."),
    body("This is not simply an outage. It is a structural failure: a system where a single breach can halt an entire economy's financial plumbing. Rebuilding the old architecture as-is would only recreate the same vulnerability."),
    h2("1.3 Affected Users"),
    bullet("Individual account holders — unable to check balances, receive salaries, or pay for essentials, forcing reliance on cash and increasing exposure to physical theft and informal, unregulated lending."),
    bullet("Small and micro businesses — unable to process digital payments, collect receivables, or access working-capital loans, stalling day-to-day trade."),
    bullet("Unbanked and under-served communities — historically dependent on agent networks and basic mobile channels, now cut off entirely and at risk of being left behind by a recovery that assumes smartphone-first access."),
    bullet("Banks and regulators — needing to restore operations without reintroducing the same systemic risk, while proving to the public that the platform is trustworthy again."),
    bullet("Loan applicants and borrowers — with stalled applications and no way to service existing debt, risking cascading defaults across the credit system."),
    h2("1.4 Why This Matters for Economic Recovery"),
    body("Digital banking is the connective tissue of a modern economy: it moves wages, settles trade, and allocates credit. Every day of continued disruption compounds financial inequality, since informal cash-only workarounds disadvantage exactly the people least able to absorb the shock — small merchants, gig workers, and lower-income households with the least access to physical banking alternatives. Restoring a secure, resilient digital banking system is therefore not just a technical fix; it is a precondition for broader economic recovery and for preventing the crisis from deepening existing inequality."),
    h2("1.5 Root Cause We Are Designing Against"),
    body("The single point of failure was architectural: one interconnected system, one shared blast radius. Our solution is explicitly designed to remove that root cause — not just restore the previous features."),
  ];
  
  // ============================================================
  // 02 PROPOSED SOLUTION
  // ============================================================
  const section02 = [
    h1("02. Proposed Solution"),
    h2("2.1 Solution Concept — RESILIA"),
    body("RESILIA is a cloud-native digital banking platform rebuilt from the ground up as a set of independent, isolated microservices instead of one monolithic core banking system. Every critical function — identity, accounts, payments, loans, fraud detection, and notifications — runs, scales, and fails independently, so a future attack on any one service cannot take down the entire bank."),
    h2("2.2 How It Solves the Identified Problem"),
    bullet("Isolation by design: each service owns its own database and is deployed in its own container, so a compromised service is contained rather than cascading across the platform — directly answering the single-point-of-failure root cause identified in Section 1.5."),
    bullet("A hardware-security-module (HSM)-backed vault protects the Master Key so it is never directly exposed to application code — services request signing operations, never the key itself."),
    bullet("Multi-region disaster recovery with a warm standby region and automated failover restores service within minutes of a regional outage, instead of leaving millions of users offline indefinitely."),
    bullet("A USSD / feature-phone channel and agent-network integration restore access for unbanked and low-connectivity users, not only smartphone owners — directly addressing the financial-inclusion dimension of the problem."),
    bullet("Real-time, AI-assisted fraud detection consumes the same event stream as transactions, so suspicious activity can be frozen before settlement instead of being discovered after the fact."),
    h2("2.3 How the Application Works — User Journey"),
    body("A customer authenticates using multi-factor authentication (password plus biometric or OTP), with step-up verification automatically triggered for unfamiliar devices or locations. Once inside, the customer can view balances, transfer funds, pay bills, and apply for credit, with every action routed through the API Gateway to the specific microservice responsible for it. Cross-service actions, such as a transfer that updates two account balances, are coordinated asynchronously through an event bus using a saga pattern, so a failure partway through rolls back safely instead of corrupting a balance. Every write is recorded to an immutable audit log to support fraud investigation and regulatory compliance."),
    h2("2.4 Value Delivered"),
    bullet("To customers: continuous access to their money and secure, fast digital transactions, restoring day-to-day financial normalcy."),
    bullet("To small businesses: reliable digital payment processing and access to credit, unblocking day-to-day trade."),
    bullet("To banks and regulators: a platform where an attack on one component cannot become a full outage, plus a full audit trail for compliance and forensics."),
    bullet("To the unbanked and rural population: continued access through agents and USSD, so recovery does not leave the most vulnerable users behind."),
    h2("2.5 Differentiation from the Pre-Attack System"),
    body("The legacy system optimised for a single deployment and one shared database. RESILIA optimises for containment, recoverability, and inclusion — the three properties the crisis showed were missing. It is designed so that the failure mode which caused the 2065 disaster — one compromise disabling everything — is structurally impossible to repeat."),
  ];
  
  // ============================================================
  // 03 SYSTEM ARCHITECTURE
  // ============================================================
  const section03 = [
    h1("03. System Architecture"),
    h2("3.1 Architecture Philosophy"),
    body("RESILIA follows a microservices architecture: each banking capability is built, deployed, and scaled as an independent service with its own database, communicating with others through a well-defined API Gateway and an asynchronous event bus. This guarantees that no single compromised or overloaded component can cascade into a total system failure, which was the central weakness exposed by the Super Malware Agent attack."),
    h2("3.2 Architecture Diagram"),
    imageParagraph("architecture.png", 620, 775),
    caption("Figure 1 — RESILIA layered microservices architecture: client layer, edge/security layer, independent microservices with the Kafka event bus, data & infrastructure layer, and observability layer."),
    h2("3.3 Layer-by-Layer Description"),
    bullet("Client layer: mobile app, web portal, branch/agent terminals, partner APIs, and a USSD gateway for feature phones — ensuring every type of user can reach the platform."),
    bullet("Edge & security layer: CDN with DDoS protection, a Web Application Firewall, the API Gateway (authentication, routing, rate limiting), and an HSM-backed vault that holds the Master Key so it is never exposed to application code."),
    bullet("Microservices layer: Identity & Auth, Account, Transaction/Payments, Loan & Credit, Fraud & Risk, Notification, Customer Profile, Audit & Compliance, and Merchant/Agent services — each with its own isolated database, connected via a Kafka event bus for asynchronous, decoupled communication."),
    bullet("Data & infrastructure layer: managed PostgreSQL per service, Redis for caching and session state, a Kubernetes cluster for auto-scaling and self-healing deployment, versioned object storage for documents, and a warm-standby secondary region for disaster recovery."),
    bullet("Observability & resilience layer: centralised logging, metrics and alerting, a SIEM for intrusion detection, automated circuit breakers, and a 24/7 Security Operations Centre dashboard."),
    h2("3.4 Data Flow Summary"),
    bullet("A client request passes through the CDN/WAF and API Gateway, where every call is authenticated using short-lived JWT tokens issued by the Identity service."),
    bullet("The Gateway routes each request to the single owning microservice; services never share databases, so a breach in one cannot directly reach another."),
    bullet("Cross-service actions (e.g. a transfer updating two accounts) are coordinated asynchronously over the Kafka event bus using a saga pattern, so a partial failure rolls back safely instead of corrupting balances."),
    bullet("The Fraud & Risk service consumes the same event stream in real time and can freeze a transaction before it settles."),
    bullet("All writes are recorded in the immutable Audit service; the Master Key never leaves the HSM vault, since services only ever request a signing operation."),
    bullet("If a region fails, traffic automatically fails over to the secondary region using replicated data, keeping the platform available."),
    h2("3.5 Why This Prevents a Repeat of the 2065 Disaster"),
    body("Each service is deployed, scaled, and secured inside its own isolated container with its own database. Malware or a breach that compromises one service — for example, Loans — is contained by network policies and cannot cascade into Accounts, Payments, or the Master Key vault. Kubernetes automatically restarts or replaces unhealthy pods, so the platform keeps serving core banking functions even during a partial outage. This directly removes the single-point-of-failure design that allowed the Super Malware Agent to take down the entire legacy banking system at once."),
  ];
  
  // ============================================================
  // 04 WIREFRAMES
  // ============================================================
  const section04 = [
    h1("04. Wireframes"),
    h2("4.1 Overview"),
    body("The high-fidelity screens cover the end-to-end customer and bank-operations journeys for RESILIA: secure access and device trust, everyday banking (dashboard, cards, payments), credit application and officer review, customer-facing fraud holds and freeze/dispute flows, and the internal Ops Console with microservice health, fraud alerts, disaster-recovery readiness, and an immutable audit trail. Security controls are visible in every journey — never an afterthought bolted on separately."),
    imageParagraph("wireframes_1.png", 630, 369),
    caption("Figure 2 — Customer screens: dashboard with security alert, e-KYC onboarding, cards, trusted devices, payment hold, and freeze & dispute."),
    imageParagraph("wireframes_2.png", 630, 369),
    caption("Figure 3 — Operations screens: Fraud & Security Ops Console, Loan Officer (Credit Desk) review, and immutable Audit Trail."),
    h2("4.2 Design Notes"),
    bullet("Dashboard: balance and recent activity are shown first, with a persistent security-alert card (e.g. new-device login blocked until MFA) so anomalies are surfaced immediately rather than buried in a menu. Quick actions for Transfer, Pay bills, Loans, and Freeze sit above the activity list."),
    bullet("e-KYC onboarding: guided identity verification with document type selection (National ID / Passport / Driving licence), ID upload, auto-extracted fields with match confidence, and a passed liveness selfie before continuing to password and MFA enrolment (FR-01)."),
    bullet("Trusted devices & MFA: customers manage trusted devices, approve or deny pending devices that were blocked until MFA, and see enrolled methods (authenticator app primary, SMS OTP backup) — implementing step-up device trust from FR-02 and FR-03."),
    bullet("Cards: debit card visual with Freeze, Limits, PIN, and Details shortcuts; online / contactless / international controls and daily limits; secondary credit-card summary — the entry point before a full freeze."),
    bullet("Payment on hold: when Fraud & Risk freezes a transaction before settlement, the customer sees amount, risk score, reason, and Held status, then can release with MFA or reject and freeze the card; auto-cancel and audit logging are explicit (FR-09)."),
    bullet("Freeze & dispute: from Security, customers can freeze a card or the entire account instantly, or raise a dispute on a specific transaction with a reason — every action writes to the immutable audit log (FR-15)."),
    bullet("Loan application (customer): guided multi-step form with a real-time AI eligibility estimate so applicants get an indicative decision without waiting days for manual review."),
    bullet("Loan officer review (Credit Desk): separate staff workspace with applicant context, AI recommendation, risk metrics (eligibility, DTI, fraud flags), and Approve / Reject actions for FR-08."),
    bullet("Fraud & Security Ops Console: shared Ops Console shell giving staff live visibility into uptime, per-microservice health, active fraud alerts, and disaster-recovery readiness — reflecting independent services directly in the tooling used to run them."),
    bullet("Audit trail: same Ops Console navigation with Audit trail active; tamper-evident event feed with category filters (Payments, Auth, Admin, Fraud, Security, Identity, Infra), KPI integrity checks, and hash-chain verification (FR-13)."),
    linkParagraph("Editable design file (Figma)", "https://www.figma.com/design/89FKRk81mO9hodlMCUpu0b/Hackathon"),
    body("High-fidelity prototypes: open the Figma file above (sharing: Anyone with the link can view). Local HTML sources live in /hifi."),
  ];
  
  // ============================================================
  // 05 FUNCTIONAL REQUIREMENTS
  // ============================================================
  const frWidths = [1300, 6900];
  const frRows = [
    ["FR-01", "Users can register through branch-assisted e-KYC or app-based onboarding with identity document verification."],
    ["FR-02", "Users can securely log in using multi-factor authentication (password + biometric, OTP, or authenticator app)."],
    ["FR-03", "The system automatically requests step-up verification when a login is attempted from a new device or location."],
    ["FR-04", "Users can view real-time account balances and a categorised transaction history."],
    ["FR-05", "Users can transfer funds between their own accounts and to other banks in real time."],
    ["FR-06", "Users can pay bills and make merchant/QR payments from linked accounts or cards."],
    ["FR-07", "Users can apply for personal or business loans and receive an automated, AI-assisted eligibility estimate."],
    ["FR-08", "Loan officers can review, approve, or reject applications with full applicant and risk-scoring context."],
    ["FR-09", "The system screens every transaction in real time and can automatically freeze suspicious transactions pending review."],
    ["FR-10", "Users receive real-time notifications (push, SMS, email) for logins, transactions, and security alerts."],
    ["FR-11", "Unbanked or low-connectivity users can check balances and transfer funds through a USSD/feature-phone channel or an agent."],
    ["FR-12", "Bank administrators can monitor microservice health, transaction volumes, and active fraud alerts from an operations console."],
    ["FR-13", "Every financial transaction and administrative action is recorded in a tamper-evident audit log."],
    ["FR-14", "The system supports automated failover to a secondary region during a regional outage, with minimal data loss."],
    ["FR-15", "Customers can raise a dispute or freeze their own card/account instantly from the app in case of suspected fraud."],
  ];
  const section05 = [
    h1("05. Functional Requirements"),
    body("The following functional requirements define what the RESILIA platform must do from a user's perspective, covering customer-facing banking operations, credit services, fraud protection, financial inclusion, and internal bank operations."),
    fullTable(["ID", "Requirement"], frRows, frWidths),
    new Paragraph({ spacing: { before: 200 }, children: [] }),
  ];
  
  // ============================================================
  // 06 NON-FUNCTIONAL REQUIREMENTS
  // ============================================================
  const nfrWidths = [1600, 1500, 5100];
  const nfrRows = [
    ["Security", "Critical", "All data encrypted in transit (TLS 1.3) and at rest (AES-256); Master Key held exclusively in an HSM-backed vault; mandatory MFA for all financial actions."],
    ["Availability", "99.9%+ uptime", "Multi-region deployment with automated failover; no single microservice outage may take down unrelated services."],
    ["Disaster Recovery", "RPO ≤ 5 min, RTO ≤ 15 min", "Continuous replication to a warm-standby secondary region with automated, tested failover procedures."],
    ["Scalability", "Elastic auto-scaling", "Each microservice scales independently under load (e.g. salary-day transaction spikes) via Kubernetes horizontal pod autoscaling."],
    ["Performance", "< 2s response time", "95th-percentile API response time under 2 seconds for core banking operations under normal load."],
    ["Auditability", "Full traceability", "Immutable, tamper-evident audit logs for every transaction and administrative action, retained per regulatory requirements."],
    ["Compliance", "Regulatory alignment", "Design aligned with PCI-DSS, ISO 27001, and applicable central-bank / data-protection regulations."],
    ["Usability & Inclusion", "Accessible to all", "Simple, accessible UI (WCAG-aligned) plus USSD/agent channels so users without smartphones or reliable internet are not excluded."],
    ["Interoperability", "Open standards", "RESTful/event-driven APIs following open standards so the platform can integrate with other banks, regulators, and fintech partners."],
    ["Maintainability", "Independent deployability", "Each microservice can be updated, patched, or rolled back independently without requiring full-system downtime."],
  ];
  const section06 = [
    h1("06. Non-Functional Requirements"),
    body("As a post-cyberattack financial platform, RESILIA's non-functional requirements place the heaviest weight on security, disaster recovery, and reliability, while still ensuring the system performs well and remains accessible to all users."),
    fullTable(["Quality Attribute", "Target", "Description"], nfrRows, nfrWidths),
    new Paragraph({ spacing: { before: 200 }, children: [] }),
  ];
  
  // ============================================================
  // 07 TECHNOLOGY STACK
  // ============================================================
  const techWidths = [1900, 3300, 3000];
  const techRows = [
    ["Frontend (Web)", "React + TypeScript, Tailwind CSS", "Component-driven UI, strong typing reduces runtime errors in a security-sensitive interface."],
    ["Frontend (Mobile)", "React Native", "Single codebase for iOS and Android, faster delivery of the same secure banking experience on mobile."],
    ["USSD/Inclusion Channel", "Africa's Talking-style USSD gateway (or regional equivalent)", "Restores access for feature-phone and low-connectivity users."],
    ["API Gateway", "Kong / AWS API Gateway", "Centralised authentication, rate limiting, and routing to independent services."],
    ["Backend Services", "Node.js (NestJS) and Java (Spring Boot) per service", "Independently deployable microservices; language chosen per service based on throughput vs. ecosystem needs (e.g. Java for core ledger, Node.js for I/O-bound services)."],
    ["Inter-service Messaging", "Apache Kafka", "Durable, asynchronous event bus decoupling services and enabling saga-based transaction coordination."],
    ["Databases", "PostgreSQL (per service), Redis (cache/session)", "Strong ACID guarantees for financial data; isolated schemas per service prevent cross-service data coupling."],
    ["AI / Fraud & Credit Scoring", "Python (scikit-learn / TensorFlow) microservice", "Real-time anomaly detection and loan-eligibility scoring, integrated via the event bus."],
    ["Containers & Orchestration", "Docker, Kubernetes (EKS/AKS)", "Auto-scaling, self-healing deployment; isolates and restarts compromised or failed services automatically."],
    ["Cloud Provider", "AWS (or Azure) multi-region", "Managed infrastructure, multi-region disaster recovery, and compliance certifications (ISO 27001, PCI-DSS)."],
    ["Security", "HashiCorp Vault / AWS KMS + HSM, OAuth2/OIDC, WAF", "Master Key protection, standards-based identity, and perimeter defence against common web attacks."],
    ["Observability", "Prometheus + Grafana, ELK Stack, SIEM", "Real-time metrics, centralised logs, and intrusion detection feeding the Security Operations Centre console."],
    ["CI/CD", "GitHub Actions / GitLab CI, Terraform (IaC)", "Automated testing and deployment pipelines with infrastructure-as-code for consistent, auditable environments."],
  ];
  const section07 = [
    h1("07. Technology Stack Selection"),
    body("The stack below was selected to support an independent-service architecture end to end: every layer, from the frontend to the database, is chosen to keep services loosely coupled, individually scalable, and secure by default — directly supporting the attack-resilience goals set out in Sections 2 and 3."),
    fullTable(["Layer", "Technology", "Justification"], techRows, techWidths),
    new Paragraph({ spacing: { before: 200 }, children: [] }),
    h2("Summary"),
    body("This combination gives RESILIA independently scalable services (Kubernetes + Kafka), strong data integrity (PostgreSQL, ACID transactions), defence-in-depth security (HSM-backed key management, WAF, OAuth2/OIDC), and full observability (Prometheus, ELK, SIEM) — the technical foundation needed to rebuild digital banking without reintroducing the single point of failure that caused the 2065 crisis."),
  ];
  
  // ============================================================
  // NUMBERING CONFIG
  // ============================================================
  const numbering = {
    config: [
      {
        reference: "main-bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 820, hanging: 260 } } } },
        ],
      },
    ],
  };
  
  // ============================================================
  // HEADER / FOOTER
  // ============================================================
  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Duothan 6.0 · Phase 01 RECON · RESILIA", size: 16, color: GREY })],
      }),
    ],
  });
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Page ", size: 16, color: GREY }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
          new TextRun({ text: " of ", size: 16, color: GREY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY }),
        ],
      }),
    ],
  });
  
  // ============================================================
  // DOCUMENT
  // ============================================================
  const doc = new Document({
    numbering,
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 } } },
        children: titlePage,
      },
      {
        properties: { page: { size: { width: 12240, height: 15840 } } },
        headers: { default: header },
        footers: { default: footer },
        children: [
          ...tocSection,
          ...section01,
          ...section02,
          ...section03,
          ...section04,
          ...section05,
          ...section06,
          ...section07,
        ],
      },
    ],
  });
  
  Packer.toBuffer(doc).then((buf) => {
    fs.writeFileSync("RESILIA_Duothan6_Phase01_Proposal.docx", buf);
    console.log("done");
  });