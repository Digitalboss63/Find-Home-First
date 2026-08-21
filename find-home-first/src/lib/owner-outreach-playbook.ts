/**
 * Owner Outreach Playbook — authoritative data module.
 *
 * This is the SINGLE source of truth for all playbook content.
 * The UI (LeadWorkspace), PDF export, and DOCX export all import from here.
 * No duplication of content elsewhere.
 *
 * Version is exported as PLAYBOOK_VERSION. Increment this constant when
 * content changes to trigger v2, v3, etc. All consumers should reference
 * PLAYBOOK_VERSION for headers, filenames, and versioning.
 */

export const PLAYBOOK_VERSION = 1;

// ─── Opening Script ───────────────────────────────────────────────────────────

export const openingScript = {
  title: "Opening Script",
  text: "Hi, I'm reaching out because I work with an organization that helps veterans secure stable housing, and your property looks like it may be a good fit for our program. Would you be open to leasing the property directly to an organization rather than an individual tenant?",
  followUps: [
    {
      prompt: "If the owner asks what the organization does:",
      response:
        "Absolutely. We help veterans who need stable housing find safe, appropriate places to live. Our organization would work directly with you regarding the property and the lease. I'd like to see the property and explain how the arrangement works. Would you have some time this week for a showing?",
    },
    {
      prompt: "If the owner asks whose name is on the lease:",
      response:
        "Our intention is for the organization to be the leaseholder, subject to us agreeing on the property, terms, and permitted use.",
    },
  ],
  primaryObjective:
    "Do not try to close the entire deal on the first call. Get permission to continue the conversation and get the meeting/showing.",
};

// ─── Outreach Framework ───────────────────────────────────────────────────────

export const outreachFramework = {
  name: "FHF Outreach Framework",
  steps: [
    "Acknowledge",
    "Explain",
    "Don't Overpromise",
    "Reduce Uncertainty",
    "Next Action",
  ],
  guidance:
    "The goal is not to out-argue the property owner. The goal is to: acknowledge the concern, answer clearly, avoid unsupported promises, reduce uncertainty, move toward the next reasonable action.",
};

// ─── Objections ───────────────────────────────────────────────────────────────

export const objections: Array<{
  id: number;
  objection: string;
  response: string;
}> = [
  {
    id: 1,
    objection: "I've never done anything like this.",
    response:
      "That's completely understandable. Most of the property owners we work with haven't either. That's part of why we want to meet with you — to walk through exactly how it works, what we would be responsible for, and what you would be responsible for. There's no commitment involved in having that conversation.",
  },
  {
    id: 2,
    objection: "Who exactly will be living there?",
    response:
      "The property would be used to house veterans who need stable housing. The specific residents would be individuals referred through our program. I'd be happy to explain the referral and screening process when we meet — that way you have the full picture before making any decision.",
  },
  {
    id: 3,
    objection: "What if somebody causes problems?",
    response:
      "That's a reasonable concern. We establish expectations for residents and have a process for addressing issues. The specifics — including what happens if a resident doesn't meet program expectations — are something we'd walk through with you before signing anything. We don't want you to have unanswered questions going in.",
  },
  {
    id: 4,
    objection: "Do I have to furnish the house?",
    response:
      "Not necessarily. Furnishing responsibility depends on the specific program and the agreement we'd put in place. Some arrangements involve the operator furnishing the property; others don't. We'd clarify that before any agreement is signed so you know exactly what's expected of each party.",
  },
  {
    id: 5,
    objection: "Why shouldn't I just rent it normally?",
    response:
      "You certainly can. We're not here to tell you what you should do with your property. What we can offer is a different arrangement — leasing directly to an organization rather than managing individual tenants yourself. Whether that's a better fit for your situation is something worth exploring. That's what the meeting is for.",
  },
  {
    id: 6,
    objection: "Are you subleasing the property?",
    response:
      "We'll explain the proposed occupancy arrangement completely when we meet. The structure depends on the specific program and agreement. We want to be transparent about how it works — including who the leaseholder would be, who the residents would be, and what each party's obligations are. That's a conversation worth having before any decisions are made.",
  },
  {
    id: 7,
    objection: "Is this legal?",
    response:
      "That's something we verify rather than make assumptions about. The legality of any specific arrangement depends on local zoning, occupancy regulations, licensing requirements, and the specific agreement structure. We take those requirements seriously, and we don't proceed with a property until we've confirmed what's required for that location. That's part of what we'd discuss before moving forward.",
  },
  {
    id: 8,
    objection: "What about occupancy limits?",
    response:
      "We don't determine occupancy simply by how many people we want to place. Occupancy is based on what's permitted for the property under applicable local codes and the specific agreement. We'd verify those requirements before signing anything, and the agreement would reflect what's actually allowed.",
  },
  {
    id: 9,
    objection: "How many people are you putting in my house?",
    response:
      "That depends on what the property can appropriately support — based on bedroom count, applicable occupancy standards, and program requirements. We don't fill properties beyond what's appropriate. The number of residents would be established in the agreement, based on what's verified for that specific property.",
  },
  {
    id: 10,
    objection: "I'm concerned about wear and tear.",
    response:
      "That's fair. Property condition matters to us too. Maintenance responsibilities, expectations for property condition, and what happens at the end of the agreement are things we'd address directly before signing. We don't want you going into an agreement without clarity on those points.",
  },
  {
    id: 11,
    objection: "How do I know I'm going to get paid?",
    response:
      "We'll show you exactly who would be financially responsible under the agreement and how payment would work. The financial structure depends on the specific program and funding source involved. We'd explain that clearly — including what happens if there's a gap — before you sign anything.",
  },
  {
    id: 12,
    objection: "How will I get paid?",
    response:
      "Payment terms would be established in the lease or agreement, and we'd walk through those with you. Depending on the program, payments may come directly from the organization, from a government voucher, or through another funding mechanism. We'd explain the specific structure that applies to this situation before asking you to commit to anything.",
  },
  {
    id: 13,
    objection: "Is this Section 8?",
    response:
      "The funding arrangement depends on the particular housing project and program involved. Some of our housing projects do involve HUD-administered vouchers; others use different funding mechanisms. We'd explain exactly what applies to this situation — including what that means for how and when you'd receive payment — when we meet.",
  },
  {
    id: 14,
    objection: "What about my insurance?",
    response:
      "That's something you should confirm with your insurance carrier. We can't tell you what your policy covers or how a change in use might affect your coverage — that depends on your specific policy and insurer. What we can do is make sure you understand the intended use of the property before you sign anything, so you can have that conversation with your carrier with accurate information.",
  },
  {
    id: 15,
    objection: "What if the neighbors complain?",
    response:
      "We establish expectations for respectful property use and have a process for addressing concerns. We can't guarantee that no neighbor will ever have a complaint — but we can tell you that we take those situations seriously and address them. We'd discuss that process when we meet.",
  },
  {
    id: 16,
    objection: "What if somebody refuses to leave?",
    response:
      "We would follow the applicable agreement and legal requirements. We don't make commitments about being able to remove someone without following the legal process — that's something that varies by jurisdiction and the specific situation. What we can tell you is that we take our obligations under the agreement seriously and address tenancy issues through the appropriate process.",
  },
  {
    id: 17,
    objection: "I've had terrible tenants/property managers before.",
    response:
      "I understand why you'd be cautious. That's a reasonable response to a bad experience. Part of what we'd want to do in our meeting is address your specific concerns directly — so you can ask us the hard questions and we can give you honest answers. We're not here to talk you into something. We're here to see if this is a fit.",
  },
  {
    id: 18,
    objection: "What happens if you can't fill the rooms?",
    response:
      "Resident occupancy and our obligations to you are separate issues. The agreement would define what we're responsible for — including how rent is handled — regardless of occupancy at any given time. We'd walk through that clearly before you sign anything, so there are no surprises.",
  },
  {
    id: 19,
    objection: "What if I decide to sell?",
    response:
      "We can discuss that before signing. How a potential sale would be handled — including any notice requirements, lease terms, and your rights as an owner — are things we'd address in the agreement. You wouldn't be signing anything that we hadn't explained clearly, including what options you'd have if your situation changed.",
  },
  {
    id: 20,
    objection: "I need to think about it.",
    response:
      "Absolutely. What information would help you make the decision? I want to make sure you have what you need. If it would help, I'm happy to follow up with something in writing, or we can schedule a time to talk again once you've had a chance to think it through.",
  },
  {
    id: 21,
    objection: "I'm not interested.",
    response:
      "Understood, and thank you for taking the time to speak with me. If your situation changes or you have questions later, I'd be glad to talk. I hope you find a good arrangement for the property.",
  },
];

// ─── Prohibited Assurances ────────────────────────────────────────────────────

export const prohibitedAssurances: {
  title: string;
  items: string[];
  guidance: string;
} = {
  title: "FHF should never present the following as automatic assurances:",
  items: [
    "This is definitely legal.",
    "Your insurance won't change.",
    "You are guaranteed payment.",
    "We can remove someone without eviction.",
    "The city allows this.",
    "We guarantee no vacancies.",
  ],
  guidance:
    "Legal, insurance, occupancy, payment, licensing, zoning, and eviction-related statements must reflect the actual property, agreement, jurisdiction, program, and verified facts.",
};

// ─── Export Disclaimer ────────────────────────────────────────────────────────

export const exportDisclaimer =
  "Operator guidance only. Confirm property-specific legal, insurance, occupancy, funding, and agreement requirements before making commitments.";
