# Find Home First — Guided Workspace UI Specification
# Frontend Handoff Document

**Prepared by:** OpenClaw (OC)  
**Visual design ownership:** REPLIT-UI  
**Status:** Approved for frontend implementation

---

## Ownership Boundary

| Responsibility | Owner |
|---|---|
| Route structure and file locations | OC |
| Typed data models and demo data | OC |
| Semantic HTML and ARIA landmarks | OC |
| Accessibility foundations (skip link, focus, reduced motion) | OC |
| All visual design — colors, typography, spacing, layout, imagery, cards, navigation appearance, sidebar, responsive presentation, component styling, dark mode, animations | **REPLIT-UI** |

OC does not make visual design decisions. Everything in this document marked **[REPLIT-UI]** is the exclusive responsibility of the frontend designer/developer.

---

## Product Summary

**Find Home First** is a housing-placement platform for housing professionals and organizations.

**Not:** a consumer home-buying site, realtor lead generator, or public MLS portal.

**Users:**
- Organization Owner
- Organization Staff
- No public resident portal
- No public property-owner portal

**Core workflow (five stages):**
1. Research
2. Find Housing
3. Secure Property
4. Match Resident
5. Move In

---

## Design Rules — Non-Negotiable

These rules apply to all pages. **[REPLIT-UI]** must enforce them throughout the design.

1. **No cluttered dashboard.** The home workspace is a guided workspace, not a metrics dashboard.
2. **No walls of cards.** Lists must be readable and scannable, not dense grids of visual noise.
3. **No decorative charts.** No pie charts, bar graphs, or gauges unless they contain real actionable data.
4. **No duplicate information.** Each data point appears once, in the right place.
5. **One clear primary action per page.** Every page has exactly one obvious next step.
6. **Large, readable text.** The platform serves professionals doing case work. Text must be comfortable to read, not cramped.
7. **No fake buttons.** Controls that are not yet functional must either not exist or be clearly marked as unavailable with a reason (e.g., `aria-disabled="true"` and visible text explanation). Never render a button that does nothing.
8. **No "coming soon" traps.** Do not create the impression of features that will never be built in this phase. Unavailable actions must be honest about why.
9. **Responsive.** The workspace must function on desktop (primary), tablet, and mobile.
10. **Keyboard accessible.** All navigation and interactive controls must be operable by keyboard. Visible focus indicators required on all interactive elements.
11. **Premium, relevant imagery only.** Any photography or illustration must directly support the page content. No generic stock. No decorative images. Every image requires meaningful alt text. **[REPLIT-UI]** selects and sources all imagery.

---

## Application Shell **[REPLIT-UI]**

The shell wraps all pages. OC has provided structural HTML landmarks only (header, nav, main, footer). **[REPLIT-UI]** owns the complete shell design including:

- Sidebar vs. top navigation decision
- Navigation appearance (icons, labels, active state, collapse behavior)
- Mobile navigation pattern (hamburger, drawer, bottom nav, or other)
- Wordmark/logo placement and appearance
- User/org identity display
- Any notification or alert badge system

### Navigation items (in order)

1. Home `/`
2. Projects `/projects`
3. Housing Search `/housing-search`
4. People & Contacts `/people`
5. Tasks `/tasks`
6. Plan & Billing `/plan`

---

## Pages

---

### 1. Home — `/`

**Purpose:** The guided workspace. The professional's starting point each session. Not a dashboard.

**Primary action (one per page):**
- Derived from the active project with the highest priority blocker, or the most urgent task.
- The action must be immediately visible without scrolling.
- Example: "Follow up on the Eastside lease signature → [Open project]"

**Blocker alert:**
- Rendered only when a blocker exists on the primary project.
- Must use `role="alert"` for screen readers.
- Do not render a blocker section when no blockers exist.
- **[REPLIT-UI]:** Design as an amber/warning-tone callout. Distinct from normal content. Not alarming, but unmissable.

**Five-stage placement journey:**
- All five stages displayed.
- Stages: Research → Find Housing → Secure Property → Match Resident → Move In.
- Context: show the stage relevant to the primary active project.
- **[REPLIT-UI]:** Design as a visual progress indicator (stepper, timeline, or equivalent). Completed stages visually differentiated from current and future stages. No clickable future stages — they are not actions.

**Active projects list:**
- Shows only active projects (status: "active").
- Each entry: project name (linked to `/projects/[id]`), resident name, current stage.
- Blocker indicator on any blocked project.
- Link: "View all projects" → `/projects`.
- Maximum recommended display: 5 projects. Overflow handled by "View all" link.

**Today's tasks list:**
- Shows tasks with `status: "today"` only.
- Each entry: task title, project name.
- Link: "All tasks" → `/tasks`.
- If no tasks: display a short honest empty state ("No tasks due today.").

**What this page must NOT contain:**
- Aggregate metrics or counts displayed as decorative numbers
- Charts or graphs
- Buttons for actions not yet available
- Sections that repeat the same data shown elsewhere on the page

---

### 2. Projects — `/projects`

**Purpose:** Full list of all housing placement projects, grouped by status.

**Primary action:** New Project — not rendered in Phase 1. Authentication does not exist yet. Add this control when auth is in place.

**Groups:**
1. Active (status: "active")
2. On Hold (status: "on-hold") — may be empty
3. Completed (status: "completed")

**Each project entry:**
- Name (linked to `/projects/[id]`)
- Community
- Resident name
- Current placement stage
- Target move-in date
- Blocker indicator (conditional, when `project.blocker` is set)

**[REPLIT-UI]:** Each entry is a navigable item (link or card-link). Not a button. Not a modal trigger. A direct navigation to the project workspace.

---

### 3. Project Workspace — `/projects/[id]`

**Purpose:** The working view for a single housing placement case. One page per project.

**Primary action:** Contextual based on current stage. Example: if stage is "Secure Property" and there is a blocker, the primary action is to resolve that blocker. **[REPLIT-UI]** designs this as the most visually prominent element on the page.

**Content (in order):**

1. Back link → `/projects`
2. Project name (`<h1>`)
3. Metadata: community, resident name, target move-in date, status
4. Blocker alert (conditional — `role="alert"`) 
5. Five-stage placement journey stepper
   - Completed stages: visually marked as done
   - Current stage: visually marked as active (`aria-current="step"`)
   - Future stages: not interactive, not clickable
6. Stage notes — for completed and current stages only. Brief text describing what was done or what is in progress.
7. Tasks — split into Open and Completed sub-lists

**[REPLIT-UI]:** The journey stepper is the visual centerpiece of this page. It must communicate progress clearly at a glance without requiring the user to read each stage label carefully.

---

### 4. Housing Search — `/housing-search`

**Purpose:** Find available private housing units for placement evaluation.

**Note:** RentCast adapter and manual Zillow entry are future phases. Demo data is used in Phase 1.

**Search form fields:**
| Field | Type | Options |
|---|---|---|
| Community | Select | All Communities, Eastside, Northview, Downtown, Westpark |
| Bedrooms | Select | Any, Studio/SRO, 1BR, 2BR, 3+BR |
| Max monthly rent | Number input | Min 0, step 50 |
| Available by | Date input | — |

- No submit button in Phase 1. Filter logic requires database/RentCast integration. Fields are rendered as `disabled` structural placeholders for layout purposes only.
- Submit and reset buttons are added by REPLIT-UI when real filtering is wired.

**Results list:**
Each result displays:
- Address
- Community
- Bedrooms (render "Studio / SRO" when `bedrooms === 0`)
- Monthly rent (formatted as currency)
- Available date
- Landlord contact
- Notes (when present)

**[REPLIT-UI]:** Results are a list, not a grid of cards. Scannable. Each result must be readable without expanding or clicking. No carousel. No pagination UI required in Phase 1.

---

### 5. People & Contacts — `/people`

**Purpose:** Two lists of people relevant to placement work. No public portal. Staff and owner only.

#### Section 1: Referral Contacts

People at partner organizations who refer residents or coordinate placements.

Each entry:
- Name
- Role and organization
- Email (as a mailto link)
- Phone
- Notes

#### Section 2: Prospective Residents

Individuals being considered for housing placement.

Each entry:
- Name
- Status: pending / active / placed
- Referred by
- Household size
- Bedrooms needed
- Accessibility needs
- Income range
- Notes

**[REPLIT-UI]:** Two clearly separated sections. Status badges or indicators for resident status. Email addresses rendered as real anchor links. Phone as plain text (not tel: links in Phase 1 — no click-to-call requirement yet).

---

### 6. Tasks — `/tasks`

**Purpose:** Task management across all projects.

**Three sections:**

| Section | Filter |
|---|---|
| Today | `status === "today"` |
| Upcoming | `status === "upcoming"` |
| Completed | `status === "completed"` |

Each task shows:
- Title
- Project name
- Due date
- (Completed tasks: visually differentiated — strikethrough or dimmed)

**[REPLIT-UI]:** 
- Checkbox-style indicators communicate done/not-done visually but are not interactive in Phase 1 (no task completion UI until auth and database exist).
- Do not render interactive checkboxes that appear functional but do nothing.
- Completed tasks may be dimmed or use strikethrough text. They should not dominate the view.

---

### 7. Plan & Billing — `/plan`

**Purpose:** Presents the two pricing tiers. No live purchase flow in Phase 1.

#### Tier 1 — $49.99/month
- 1 Organization Owner
- No staff accounts
- No Admin Console
- Unlimited projects, full workflow, housing search, people, tasks

#### Tier 2 — $79/month (launch price)
- 1 Organization Owner
- Unlimited staff accounts
- Admin Console
- Unlimited projects, full workflow, housing search, people, tasks

**CTA buttons:** Not rendered in Phase 1. Stripe does not exist yet. Add purchase/select controls when billing is wired.

**[REPLIT-UI]:**
- Two plans displayed side by side on desktop, stacked on mobile.
- Tier 2 is the recommended plan and may be visually highlighted.
- No countdown timers, no urgency language, no dark patterns.
- Honest: users must understand they cannot purchase yet.

---

## Accessibility Requirements (all pages)

These are enforced by OC in the structural foundation. **[REPLIT-UI]** must not break them.

| Requirement | Details |
|---|---|
| Skip link | Present, targets `#main-content`, visible on focus |
| Semantic landmarks | `<header role="banner">`, `<nav>`, `<main id="main-content">`, `<footer role="contentinfo">` |
| Heading hierarchy | Each page has exactly one `<h1>`. Subsections use `<h2>` and below in order. |
| Focus indicators | Visible on all interactive elements. Do not remove or suppress `:focus-visible`. |
| Reduced motion | CSS `prefers-reduced-motion` block must be preserved. |
| Screen-reader text | `.sr-only` utility class available for visually hidden but announced text. |
| `aria-current="page"` | Applied to the active navigation item. |
| `aria-current="step"` | Applied to the current stage in placement journey steppers. |
| `role="alert"` | Applied to blocker alerts. |
| Alt text | Every image requires descriptive alt text. No `alt=""` on informational images. |
| Color contrast | Must meet WCAG 2.1 AA minimum (4.5:1 for normal text, 3:1 for large text). |
| Keyboard navigation | All controls reachable and operable by keyboard. No keyboard traps. |

---

## Data Models

All typed interfaces are in `src/demo/data.ts`. The following models exist:

| Model | Interface | Purpose |
|---|---|---|
| Placement stage | `Stage`, `StageKey` | Five-step workflow definition |
| Project | `DemoProject`, `ProjectStatus` | Housing placement cases |
| Task | `DemoTask`, `TaskStatus` | Tasks across projects |
| Referral contact | `DemoReferralContact` | Partner org contacts |
| Prospective resident | `DemoProspectiveResident`, `ResidentStatus` | People being placed |
| Property | `DemoProperty` | Available housing units |
| Plan | `DemoPlan` | Pricing tiers |

Demo records are in the same file, clearly labeled. All must be replaced by real API calls in future phases.

---

## What Is Not Built Yet (Future Phases)

| Feature | Phase |
|---|---|
| Authentication (Clerk or equivalent) | Phase 2 |
| PostgreSQL database | Phase 2 |
| New Project creation | After auth |
| Task completion (interactive) | After database |
| Housing search filtering (real) | After database/RentCast adapter |
| Manual Zillow lead entry | After database |
| Stripe billing | Phase 3 |
| Admin Console | After auth + Tier 2 |
| Private document storage | Future |
| Constrained AI Guide | Future |
| ADA widget integration (owner-controlled) | After auth + database + back office — see `docs/future-requirements/ada-widget-integration.md` |

---

## File Locations

```
src/
  app/
    layout.tsx                    Root layout (SkipLink + SiteHeader + main + SiteFooter)
    globals.css                   Accessibility foundations only — no brand tokens
    page.tsx                      / — Home workspace
    projects/
      page.tsx                    /projects — Projects list
      [id]/page.tsx               /projects/[id] — Project workspace
    housing-search/page.tsx       /housing-search — Housing Search
    people/page.tsx               /people — People & Contacts
    tasks/page.tsx                /tasks — Tasks
    plan/page.tsx                 /plan — Plan & Billing
  components/
    SkipLink.tsx                  Skip-to-main-content link
    SiteHeader.tsx                Structural header + nav (no visual design)
    SiteFooter.tsx                Structural footer (no visual design)
  demo/
    data.ts                       All typed models and demonstration data
docs/
  frontend-handoff/
    GUIDED_WORKSPACE_UI_SPEC.md   This document
  future-requirements/
    ada-widget-integration.md     Deferred ADA widget requirement
```

---

*This document is maintained by OC. Visual design implementation questions should be directed to REPLIT-UI.*
