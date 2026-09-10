export default function HelpPage() {
  const sections = [
    {
      title: "Getting started",
      items: [
        { q: "What is ClaimGuard?", a: "ClaimGuard is an AI-powered claims analytics and decision-support platform. It scores incoming claims for fraud risk, applies business rules, and routes borderline cases to a human review queue." },
        { q: "How do I review a case?", a: "Navigate to Review Queue in the sidebar. Cases are sorted by priority score. Click Review on any item to open the full case detail with ML predictions and rule flags." },
      ],
    },
    {
      title: "ML & Scoring",
      items: [
        { q: "What does the fraud score mean?", a: "The fraud score (0–1) is the model's estimated probability that a claim is fraudulent. Scores above 0.7 are flagged as High or Critical risk." },
        { q: "What is the champion model?", a: "The champion is the currently active production model. Challengers are evaluated alongside it. You can promote a challenger from the ML Admin page." },
      ],
    },
    {
      title: "Data & Integrations",
      items: [
        { q: "Where does case data come from?", a: "Cases are ingested from InsureMaster (live or faker mode). The ingestion mode is controlled by the INSUREMASTER_MODE environment variable in the backend." },
        { q: "Who do I contact for support?", a: "Reach out to your platform administrator or the ClaimGuard engineering team at support@claimguard.co.ke." },
      ],
    },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Help & Support</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Frequently asked questions and platform guidance.
      </p>

      <div className="max-w-2xl space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.items.map((item) => (
                <div key={item.q}>
                  <p className="text-sm font-medium">{item.q}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
