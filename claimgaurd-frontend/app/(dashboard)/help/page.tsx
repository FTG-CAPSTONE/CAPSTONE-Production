"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, MailIcon, BookOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    section: "Getting Started",
    items: [
      {
        q: "What is ClaimGuard?",
        a: "ClaimGuard is an AI-powered claims intelligence platform for the Kenyan insurance market. It sits alongside InsureMaster as a read-only intelligence overlay — ingesting claims, scoring them for fraud risk, applying business rules, and routing borderline cases to human reviewers. It never writes policies or claims back into InsureMaster.",
      },
      {
        q: "How do I review a case?",
        a: "Navigate to Review Queue in the sidebar. Cases are sorted by priority score (a combination of fraud probability, rule flags, and model confidence). Click Review on any item to open the full case detail, where you'll see the ML risk assessment, SHAP explanations, rule flags, and the decision form.",
      },
      {
        q: "What does the priority score mean?",
        a: "Priority ranges from 0–100. Scores ≥ 80 are red (Critical), 40–79 are orange (High), and below 40 are yellow (Medium). It combines the fraud probability score, the number of rule flags triggered, and the inverse of model confidence — high confidence auto-decisions are never sent to the queue.",
      },
    ],
  },
  {
    section: "ML & Scoring",
    items: [
      {
        q: "What does the fraud score represent?",
        a: "The fraud score (0–100) is the model's estimated probability that a claim is fraudulent, scaled to a 0–100 range. Scores 0–39 are Low, 40–59 Medium, 60–79 High, 80–100 Critical. Low-confidence scores are flagged and routed to human review regardless of the band.",
      },
      {
        q: "What are the SHAP drivers?",
        a: "SHAP (SHapley Additive exPlanations) values explain which features pushed the fraud score up or down. Positive SHAP values increase the score; negative values decrease it. The top 5 drivers are shown as a horizontal bar chart on the Intelligence tab of each case.",
      },
      {
        q: "What is the champion model?",
        a: "The champion is the currently active production model. Challenger models are trained alongside it. You can view challengers in ML Admin and compare their Precision, Recall, F1, and AUC metrics against the champion before deciding to promote or reject.",
      },
      {
        q: "Why does a case show 'No champion model registered'?",
        a: "If no model has been promoted to champion status yet, all cases route to human review. Trigger a retraining run in ML Admin, then review and promote the resulting challenger model.",
      },
    ],
  },
  {
    section: "Claims & Workflow",
    items: [
      {
        q: "What are the possible case statuses?",
        a: "Received → Processing → (Auto Approved | Auto Rejected | In Review) → (Approved | Declined | Escalated). The rules engine can hard-block a case before ML scoring, which produces Auto Rejected. Low/medium risk with high confidence produces Auto Approved. Everything else enters the review queue.",
      },
      {
        q: "Why is my rationale mandatory?",
        a: "Every decision made by a human reviewer is permanently recorded in the audit trail and is immutable. The rationale is required under IRA (Insurance Regulatory Authority of Kenya) guidelines for audit traceability and cannot be edited after submission.",
      },
      {
        q: "What happens when I escalate a case?",
        a: "Escalated cases are routed to an investigator for deeper review. A new Investigation record is created, linked to the case. The investigator can log notes, view similar historical cases, and ultimately close the investigation with an outcome (fraud confirmed, legitimate, or inconclusive).",
      },
    ],
  },
  {
    section: "Data & Integrations",
    items: [
      {
        q: "Where does case data come from?",
        a: "In production, claims are pushed via a webhook from InsureMaster when a new claim is created. In development, synthetic motor claims are generated using the Faker data strategy (INSUREMASTER_MODE=faker in the backend environment).",
      },
      {
        q: "What lines of business are supported?",
        a: "The MVP focuses on Motor claims (private motor, commercial motor, PSV). Health, Marine Cargo, and General are designed as extension points — the line_of_business field is first-class throughout the schema and will be enabled in future phases.",
      },
      {
        q: "Who do I contact for technical support?",
        a: "Reach the ClaimGuard engineering team at support@claimguard.co.ke or through your platform administrator.",
      },
    ],
  },
];

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-3.5 text-left text-sm font-medium hover:text-primary transition-colors"
      >
        <span>{q}</span>
        {open
          ? <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          : <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-200",
        open ? "max-h-96 pb-4" : "max-h-0",
      )}>
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Help & Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Frequently asked questions and platform guidance.
        </p>
      </div>

      {/* FAQ sections */}
      {FAQS.map((section) => (
        <div key={section.section} className="rounded-xl border border-border bg-card px-5 py-1">
          <p className="py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
            {section.section}
          </p>
          {section.items.map((item) => (
            <AccordionItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      ))}

      {/* Contact */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Contact & Documentation
        </p>
        <div className="flex items-center gap-3 text-sm">
          <MailIcon className="size-4 text-muted-foreground shrink-0" />
          <a href="mailto:support@claimguard.co.ke"
            className="text-primary hover:underline">
            support@claimguard.co.ke
          </a>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <BookOpenIcon className="size-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            Full technical documentation is in the <code className="text-xs bg-muted px-1 py-0.5 rounded">REFERENCE/</code> folder of the repository.
          </span>
        </div>
      </div>
    </div>
  );
}
