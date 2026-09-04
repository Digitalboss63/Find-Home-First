export type HelpCategory =
  | "Getting Started"
  | "Projects"
  | "Market Intelligence"
  | "Properties"
  | "People"
  | "Tasks"
  | "Account";

export type HelpTopic = {
  id: string;
  category: HelpCategory;
  title: string;
  shortDescription: string;
  whyItMatters: string;
  whenToUse: string;
  steps: string[];
  requiredInfo?: string[];
  commonMistakes?: string[];
  nextAction: string;
  route?: string;
  routeLabel?: string;
  videoUrl?: string;
  keywords: string[];
  contexts: string[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started",
    category: "Getting Started",
    title: "Getting started with Find Home First",
    shortDescription:
      "Use Find Home First as a guided housing workspace: research the market, create a project, find a property, build referral relationships, place residents, and keep the next action clear.",
    whyItMatters:
      "The app is designed to keep housing work in one workflow instead of spreading it across spreadsheets, browser tabs, notes, texts, and memory.",
    whenToUse: "Start here when you are new to the app or unsure which area to open first.",
    steps: [
      "Create or open a housing project.",
      "Review the project's current stage, status, blockers, and next action.",
      "Use market intelligence to identify promising ZIP codes and confirm the target area.",
      "Find and evaluate properties for that project.",
      "Track landlords, referral contacts, and prospective residents.",
      "Complete the next action shown for the project until placement is confirmed.",
    ],
    nextAction: "Open Projects and choose the housing project you want to move forward.",
    route: "/projects",
    routeLabel: "Open Projects",
    keywords: ["start", "begin", "new", "how does this work", "workflow", "what do i do"],
    contexts: ["/"],
  },
  {
    id: "projects",
    category: "Projects",
    title: "Housing projects",
    shortDescription:
      "A project is the main workspace for one housing opportunity. It keeps the market, property, people, tasks, status, blockers, and next action connected.",
    whyItMatters:
      "Without a project, information can become disconnected. The project is the source of context for the work you are trying to complete.",
    whenToUse: "Create a project when you have a housing market or opportunity you intend to actively pursue.",
    steps: [
      "Create the project and identify its target geography.",
      "Review the current stage and status.",
      "Complete the requested next action before moving the project forward.",
      "Keep property, contact, resident, and task activity associated with the correct project.",
    ],
    requiredInfo: ["Project name", "Target city/state or market", "Current stage/status"],
    commonMistakes: [
      "Creating multiple projects for the same active opportunity without a reason.",
      "Searching a different city or ZIP without confirming that the project context changed too.",
    ],
    nextAction: "Open the project that needs attention and follow its displayed next action.",
    route: "/projects",
    routeLabel: "Open Projects",
    keywords: ["project", "workspace", "stage", "status", "opportunity"],
    contexts: ["/projects"],
  },
  {
    id: "status-next-action",
    category: "Projects",
    title: "Status, blockers, and Next Action",
    shortDescription:
      "Status tells you where the project stands. Blockers tell you what is preventing progress. Next Action tells you the most useful thing to do now.",
    whyItMatters:
      "Find Home First is built around reducing operational confusion. A project should not leave you wondering what to do next.",
    whenToUse: "Check these whenever you reopen a project or feel unsure about the next step.",
    steps: [
      "Read the current status before doing new work.",
      "Resolve any blocker that prevents the next stage.",
      "Complete the Next Action shown in the workspace.",
      "Update the project only when the real-world condition has actually changed.",
    ],
    commonMistakes: [
      "Advancing a status because work was started instead of because the milestone was actually reached.",
      "Ignoring a blocker and doing unrelated work that does not move the project forward.",
    ],
    nextAction: "Return to the project workspace and complete the current Next Action.",
    route: "/projects",
    routeLabel: "Open Projects",
    keywords: ["next action", "status", "blocker", "stuck", "what next", "stage"],
    contexts: ["/projects"],
  },
  {
    id: "market-intelligence",
    category: "Market Intelligence",
    title: "Market intelligence",
    shortDescription:
      "Market intelligence helps you decide where to look for housing by combining need, veteran and demographic indicators, housing economics, rent benchmarks, and source confidence.",
    whyItMatters:
      "The goal is not simply to find a rental. It is to identify places where housing need and workable economics have a strong chance of intersecting.",
    whenToUse: "Use it before committing significant time or money to a new market or property search.",
    steps: [
      "Choose the target city or market for the project.",
      "Generate or review the market report.",
      "Compare ranked ZIP codes and the evidence behind each result.",
      "Review source confidence and any unavailable or estimated data.",
      "Select a ZIP to hand into Property Search when you are ready to look for inventory.",
    ],
    commonMistakes: [
      "Treating an estimate as an exact local fact.",
      "Choosing a ZIP based on one score without reviewing the underlying evidence and economics.",
    ],
    nextAction: "Review the ranked ZIPs for the current project and choose the strongest search target.",
    route: "/projects",
    routeLabel: "Open Projects",
    keywords: ["market", "report", "research", "zip", "veteran", "demographics", "demand"],
    contexts: ["/projects"],
  },
  {
    id: "opportunity-score",
    category: "Market Intelligence",
    title: "Opportunity Score",
    shortDescription:
      "Opportunity Score is a comparative signal that helps rank ZIP codes using the evidence available to Find Home First. It is a decision aid, not a guarantee that a property or program will work.",
    whyItMatters:
      "It helps narrow a large market into places worth investigating first while keeping source quality and missing data visible.",
    whenToUse: "Use it to compare ZIP codes inside the same market report.",
    steps: [
      "Compare the score with the other ZIPs in the report.",
      "Open the evidence and confidence details behind the ranking.",
      "Review rent economics and local housing availability before selecting the ZIP.",
      "Use the ranking to prioritize research, not replace program confirmation or property due diligence.",
    ],
    commonMistakes: [
      "Reading the score as a promise of profitability or program eligibility.",
      "Ignoring confidence warnings or missing-source notices.",
    ],
    nextAction: "Compare the top-ranked ZIPs and select one only after reviewing the supporting evidence.",
    route: "/projects",
    routeLabel: "Review Market Report",
    keywords: ["score", "opportunity score", "rank", "ranking", "best zip", "confidence"],
    contexts: ["/projects"],
  },
  {
    id: "fmr",
    category: "Market Intelligence",
    title: "Fair Market Rent (FMR)",
    shortDescription:
      "HUD Fair Market Rent is a rent benchmark used in housing analysis. It helps establish local rent context, but it is not automatically the payment amount a specific program will pay.",
    whyItMatters:
      "Property economics cannot be evaluated responsibly without a credible rent benchmark, but program payment standards still need confirmation when they differ from FMR.",
    whenToUse: "Review FMR when comparing markets and evaluating the rent economics of a property.",
    steps: [
      "Review the FMR benchmark shown for the relevant geography and bedroom size.",
      "Check whether the report is using exact local data or a clearly labelled fallback area.",
      "Confirm any program-specific payment standard with the program administrator when needed.",
      "Use confirmed figures in the final property economics decision.",
    ],
    commonMistakes: [
      "Calling FMR a guaranteed voucher or program payment.",
      "Using a listing's asking rent as though it were HUD FMR.",
    ],
    nextAction: "Use FMR as the benchmark, then confirm the actual program payment standard when required.",
    keywords: ["fmr", "fair market rent", "hud", "payment standard", "rent benchmark"],
    contexts: ["/projects", "/housing-search"],
  },
  {
    id: "property-search",
    category: "Properties",
    title: "Find Properties",
    shortDescription:
      "Find Properties searches the active project's target area and lets you turn promising listings into tracked housing opportunities instead of disconnected browser tabs.",
    whyItMatters:
      "The property search should stay tied to the project and ZIP you deliberately selected so the results remain relevant to the housing plan.",
    whenToUse: "Use it after you have a target market or ZIP and are ready to identify real properties.",
    steps: [
      "Confirm the project, city/state, and ZIP at the top of the search.",
      "Set practical property and rent filters.",
      "Review listings against both operational needs and economics.",
      "Save or move promising properties into the project workflow.",
      "Begin landlord outreach and property due diligence.",
    ],
    requiredInfo: ["Active project", "Target geography", "Property requirements", "Rent range"],
    commonMistakes: [
      "Searching a ZIP that does not match the current project context.",
      "Treating a listing as viable before checking economics and landlord acceptance.",
    ],
    nextAction: "Confirm the search geography, then save the strongest property candidates to the project.",
    route: "/housing-search",
    routeLabel: "Find Properties",
    keywords: ["property", "properties", "search", "listing", "rent", "find house"],
    contexts: ["/housing-search"],
  },
  {
    id: "property-economics",
    category: "Properties",
    title: "Property economics",
    shortDescription:
      "Property economics helps you decide whether a housing opportunity can support itself before you commit to a lease or major expense.",
    whyItMatters:
      "A property can look attractive and still fail financially. The purpose is to expose that risk before money is committed.",
    whenToUse: "Use it before lease commitment and whenever rent, room count, payment assumptions, or operating costs change materially.",
    steps: [
      "Enter the property's monthly rent.",
      "Confirm usable room count and realistic occupancy.",
      "Enter the best-supported per-room or program revenue assumption.",
      "Add utilities and recurring operating costs.",
      "Review estimated revenue, expense, and margin together.",
      "Confirm program-specific payment assumptions before final commitment.",
    ],
    requiredInfo: ["Monthly property rent", "Usable rooms", "Expected occupancy", "Revenue/payment assumption", "Utilities and operating costs"],
    commonMistakes: [
      "Using maximum occupancy instead of realistic occupancy.",
      "Using an unconfirmed program payment as guaranteed revenue.",
      "Ignoring utilities, vacancy, or other recurring costs.",
    ],
    nextAction: "Do not commit to the property until the economics are supportable with realistic assumptions.",
    keywords: ["economics", "profit", "margin", "revenue", "rooms", "cost", "viable"],
    contexts: ["/housing-search", "/projects"],
  },
  {
    id: "landlord-outreach",
    category: "Properties",
    title: "Landlord outreach",
    shortDescription:
      "Landlord outreach tracks property-owner conversations, follow-ups, objections, approvals, and the next step for a potential property.",
    whyItMatters:
      "Housing opportunities often stall because follow-up is scattered across calls, texts, notes, and memory. The CRM record keeps the relationship actionable.",
    whenToUse: "Use it as soon as you contact an owner or property manager about a candidate property.",
    steps: [
      "Record the landlord or property-manager contact.",
      "Log the property and the result of each conversation.",
      "Record objections, requirements, and requested documents.",
      "Schedule the next follow-up instead of relying on memory.",
      "Update approval or lease status only when the owner has actually confirmed it.",
    ],
    nextAction: "Record the most recent landlord conversation and schedule the next follow-up.",
    keywords: ["landlord", "owner", "outreach", "follow up", "lease", "approval"],
    contexts: ["/housing-search", "/projects", "/people"],
  },
  {
    id: "referral-network",
    category: "People",
    title: "Referral contacts",
    shortDescription:
      "Referral contacts are caseworkers, social workers, veteran organizations, nonprofits, and other people who can connect eligible residents with available housing.",
    whyItMatters:
      "A reliable referral network reduces the need to rebuild relationships every time a room becomes available.",
    whenToUse: "Add a referral contact whenever you establish a real relationship with someone who may refer prospective residents.",
    steps: [
      "Add the person's name, organization, role, and contact details.",
      "Record what population or program they serve.",
      "Note relationship history and relevant requirements.",
      "Follow up when housing becomes available or project status changes.",
    ],
    commonMistakes: [
      "Treating a cold name in a directory as an established referral relationship.",
      "Failing to record which project, geography, or population the contact actually supports.",
    ],
    nextAction: "Add or update the referral contacts most relevant to your active housing project.",
    route: "/people",
    routeLabel: "Open People & Contacts",
    keywords: ["referral", "caseworker", "social worker", "va", "contact", "organization"],
    contexts: ["/people", "/projects"],
  },
  {
    id: "prospective-residents",
    category: "People",
    title: "Prospective residents",
    shortDescription:
      "Prospective residents are people being considered for placement. Their record helps track referral source, readiness, housing needs, documentation, and placement progress.",
    whyItMatters:
      "The right housing placement requires more than an open bed. Resident needs and readiness must be matched to the actual property and program.",
    whenToUse: "Create a resident record when a real referral or housing candidate enters the placement process.",
    steps: [
      "Record the referral source and basic contact information.",
      "Document housing needs, relevant accommodations, and readiness.",
      "Track required documents and unresolved placement issues.",
      "Match the person only to housing that can actually meet the identified needs.",
      "Update placement status as milestones are confirmed.",
    ],
    nextAction: "Review which prospective residents are placement-ready and what each still needs.",
    route: "/people",
    routeLabel: "Open People & Contacts",
    keywords: ["resident", "veteran", "placement", "move in", "referral", "prospect"],
    contexts: ["/people", "/projects"],
  },
  {
    id: "tasks",
    category: "Tasks",
    title: "Tasks and follow-ups",
    shortDescription:
      "Tasks turn project obligations and follow-ups into visible work with clear ownership and timing.",
    whyItMatters:
      "Calls, documents, inspections, landlord follow-ups, and placement deadlines are easy to lose when they live only in memory or email.",
    whenToUse: "Create a task whenever something must happen later or needs a clear owner and due date.",
    steps: [
      "Describe the action in plain language.",
      "Associate it with the correct project when applicable.",
      "Set a realistic due date.",
      "Complete the task only when the underlying action is actually done.",
    ],
    nextAction: "Open Tasks and complete the highest-priority overdue or due-soon action.",
    route: "/tasks",
    routeLabel: "Open Tasks",
    keywords: ["task", "follow up", "deadline", "due", "reminder", "to do"],
    contexts: ["/tasks", "/projects"],
  },
  {
    id: "plan-billing",
    category: "Account",
    title: "Plan and billing",
    shortDescription:
      "Plan & Billing is where account-level subscription information and available plan options are managed.",
    whyItMatters:
      "Billing settings should remain separate from housing project operations so users do not confuse account administration with project work.",
    whenToUse: "Use it when reviewing subscription level, account billing, or plan availability.",
    steps: [
      "Open Plan & Billing.",
      "Review the current plan and available account actions.",
      "Use billing support if a payment or subscription issue cannot be resolved from the page.",
    ],
    nextAction: "Open Plan & Billing only if your question is about the account rather than a housing project.",
    route: "/plan",
    routeLabel: "Open Plan & Billing",
    keywords: ["billing", "plan", "price", "subscription", "payment", "account"],
    contexts: ["/plan", "/support/billing"],
  },
];

export const HELP_CATEGORIES: HelpCategory[] = [
  "Getting Started",
  "Projects",
  "Market Intelligence",
  "Properties",
  "People",
  "Tasks",
  "Account",
];

export function getHelpTopic(id: string) {
  return HELP_TOPICS.find((topic) => topic.id === id) ?? null;
}

export function getContextHelpTopics(pathname: string) {
  const contextual = HELP_TOPICS.filter((topic) =>
    topic.contexts.some((context) =>
      context === "/" ? pathname === "/" : pathname.startsWith(context),
    ),
  );

  return contextual.length > 0 ? contextual : [HELP_TOPICS[0]];
}

export function searchHelpTopics(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return HELP_TOPICS;

  return HELP_TOPICS.map((topic) => {
    const haystack = [
      topic.title,
      topic.shortDescription,
      topic.whyItMatters,
      topic.whenToUse,
      topic.nextAction,
      ...topic.keywords,
      ...topic.steps,
      ...(topic.requiredInfo ?? []),
      ...(topic.commonMistakes ?? []),
    ]
      .join(" ")
      .toLowerCase();

    let score = 0;
    for (const token of normalized.split(/\s+/).filter(Boolean)) {
      if (topic.title.toLowerCase().includes(token)) score += 5;
      if (topic.keywords.some((keyword) => keyword.includes(token))) score += 4;
      if (haystack.includes(token)) score += 1;
    }

    return { topic, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ topic }) => topic);
}
