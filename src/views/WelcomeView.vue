<script setup lang="ts">
import {
  Scale,
  ShieldCheck,
  Mail,
  FileText,
  MessagesSquare,
  ListChecks,
  Landmark,
  BookOpenCheck,
  ArrowRight,
  Check,
} from 'lucide-vue-next'

const states = [
  'Ohio', 'Texas', 'Oklahoma', 'Arkansas', 'Missouri', 'Kansas', 'Colorado', 'Tennessee',
  'Minnesota', 'Florida', 'Wisconsin', 'Illinois', 'New Mexico', 'North Dakota', 'Montana',
]

const steps = [
  {
    icon: Mail,
    title: 'Forward the adjuster’s email',
    text: 'Drop the insurer’s .eml straight into the case. Every message, estimate, and short-pay lands on one timeline, and the fact ledger keeps dates and amounts straight.',
  },
  {
    icon: FileText,
    title: 'The AI drafts your response',
    text: 'Pick the tone — cooperative to final notice. The draft is grounded in your case’s own facts and cites your state’s real insurance regulations, verbatim.',
  },
  {
    icon: ShieldCheck,
    title: 'You review, send, and escalate',
    text: 'Nothing goes out without you. When the insurer stalls, the ladder climbs: documented-delivery notices, bad-faith notices, and the regulator complaint path.',
  },
]

const features = [
  {
    icon: Landmark,
    title: 'Verified state playbooks',
    text: '15 states of fair-claims law — deadlines, anti-steering rules, interest penalties, repair liens — every provision quote-backed against the official statute text.',
  },
  {
    icon: BookOpenCheck,
    title: 'No made-up law. Ever.',
    text: 'A deterministic citation validator checks every draft against the curated playbook. If the AI can’t back a citation, the draft is rejected — before you ever see it.',
  },
  {
    icon: ListChecks,
    title: 'The escalation ladder',
    text: 'Five rungs from cooperative reply to final notice. The AI tells you which rung you’re on and never accuses bad faith before your ledger documents the pattern.',
  },
  {
    icon: FileText,
    title: 'Fact ledger & documents',
    text: 'Every date, amount, estimate, and delivery is logged per case. When the adjuster “never received” your supplement, you answer with the exact date they did.',
  },
  {
    icon: MessagesSquare,
    title: 'Negotiation copilot',
    text: 'Ask “what’s my next move?” mid-case. The copilot reads the whole thread and answers with strategy grounded in your state’s rules — not generic advice.',
  },
  {
    icon: Scale,
    title: 'A paper trail that holds up',
    text: 'Every message and draft is timestamped and preserved. If a case ever reaches your regulator — or your attorney — the record is already built.',
  },
]
</script>

<template>
  <div class="landing">
    <header class="nav">
      <div class="nav-inner">
        <div class="brand">
          <Scale :size="19" class="brand-icon" />
          <span>DSM <strong>Negotiator</strong></span>
        </div>
        <div class="nav-right">
          <RouterLink :to="{ name: 'login' }" class="btn btn-ghost">Log in</RouterLink>
          <RouterLink :to="{ name: 'register' }" class="btn btn-primary">Get started</RouterLink>
        </div>
      </div>
    </header>

    <section class="hero">
      <div class="hero-glow" aria-hidden="true"></div>
      <span class="hero-badge">AI-powered insurance negotiation for hail &amp; PDR shops</span>
      <h1>
        Stop letting insurers keep
        <span class="grad">money that's yours.</span>
      </h1>
      <p class="hero-sub">
        Short pays, denied supplements, endless re-requests — for a busy hail shop that's easily an
        extra <strong>$100,000+ a year</strong> left on the table. DSM Negotiator drafts the
        letters that get it paid, backed by your state's actual insurance law.
      </p>
      <div class="hero-ctas">
        <RouterLink :to="{ name: 'register' }" class="btn btn-primary btn-lg">
          Start your free trial <ArrowRight :size="16" />
        </RouterLink>
        <RouterLink :to="{ name: 'login' }" class="btn btn-lg">I have an account</RouterLink>
      </div>
      <p class="hero-note muted">7-day free trial · Your team included · Cancel anytime</p>

      <div class="hero-stats">
        <div class="stat">
          <span class="stat-num">15</span>
          <span class="stat-label">states of verified claims law</span>
        </div>
        <div class="stat">
          <span class="stat-num">100%</span>
          <span class="stat-label">of citations checked before you see a draft</span>
        </div>
        <div class="stat">
          <span class="stat-num">5</span>
          <span class="stat-label">escalation rungs, cooperative → final notice</span>
        </div>
        <div class="stat">
          <span class="stat-num">Seconds</span>
          <span class="stat-label">from adjuster email to adjuster-ready reply</span>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">You fix the cars. It fights the runaround.</h2>
      <p class="section-sub muted">Three steps, every claim.</p>
      <div class="steps">
        <div v-for="(s, i) in steps" :key="s.title" class="step card">
          <div class="step-num">{{ i + 1 }}</div>
          <component :is="s.icon" :size="22" class="step-icon" />
          <h3>{{ s.title }}</h3>
          <p class="muted">{{ s.text }}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Built like a negotiator, not a chatbot</h2>
      <p class="section-sub muted">
        Every feature exists because an adjuster somewhere uses the opposite against you.
      </p>
      <div class="features">
        <div v-for="f in features" :key="f.title" class="feature card">
          <component :is="f.icon" :size="20" class="feature-icon" />
          <h3>{{ f.title }}</h3>
          <p class="muted">{{ f.text }}</p>
        </div>
      </div>
    </section>

    <section class="section states-band">
      <h2 class="section-title">Your state's law, chapter and verse</h2>
      <p class="section-sub muted">
        Each playbook is researched against official statute text, flagged for first- vs
        third-party scope, and maintained on an attorney-review pipeline.
      </p>
      <div class="states-grid">
        <span v-for="st in states" :key="st" class="state-chip">
          <Check :size="13" /> {{ st }}
        </span>
      </div>
      <p class="muted small">More states added by demand — tell us where you chase hail.</p>
    </section>

    <section class="section" id="pricing">
      <h2 class="section-title">One recovered supplement pays for the year</h2>
      <p class="section-sub muted">Flat annual pricing, per shop location. Every seat included.</p>
      <div class="pricing">
        <div class="price-card card">
          <h3>DSM Negotiator</h3>
          <div class="price"><span class="price-num">$1,999</span><span class="muted">/year</span></div>
          <ul>
            <li><Check :size="14" /> Unlimited cases &amp; team seats</li>
            <li><Check :size="14" /> AI drafting, copilot chat &amp; .eml intake</li>
            <li><Check :size="14" /> All 15 state playbooks, kept current</li>
            <li><Check :size="14" /> Fact ledger, documents &amp; full paper trail</li>
          </ul>
          <RouterLink :to="{ name: 'register' }" class="btn btn-primary">Start free trial</RouterLink>
        </div>
        <div class="price-card card featured">
          <span class="pill pill-blue deal-pill">For Dent Shop Manager subscribers</span>
          <h3>Bundle price</h3>
          <div class="price">
            <span class="price-num">$999</span><span class="muted">/year</span>
            <span class="price-was muted">$1,999</span>
          </div>
          <ul>
            <li><Check :size="14" /> Everything in DSM Negotiator</li>
            <li><Check :size="14" /> 50% off with your active DSM subscription</li>
            <li><Check :size="14" /> One login for your whole shop</li>
          </ul>
          <RouterLink :to="{ name: 'register' }" class="btn btn-primary">Start free trial</RouterLink>
        </div>
      </div>
    </section>

    <section class="section final-cta">
      <h2 class="section-title">The insurer has software writing their letters.<br />Now you do too.</h2>
      <RouterLink :to="{ name: 'register' }" class="btn btn-primary btn-lg">
        Create your shop <ArrowRight :size="16" />
      </RouterLink>
    </section>

    <footer class="footer">
      <p class="faint">
        DSM Negotiator is not a law firm and does not provide legal advice. Drafts are prepared for
        your review — you approve and send every letter, and complex disputes deserve an attorney.
      </p>
      <p class="faint">© {{ new Date().getFullYear() }} Dent Shop Manager</p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  flex: 1;
}
.small {
  font-size: 12.5px;
}

/* nav */
.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(11, 18, 32, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-soft);
}
.nav-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15.5px;
}
.brand strong {
  font-weight: 700;
}
.brand-icon {
  color: var(--accent);
}
.nav-right {
  display: flex;
  gap: 10px;
}
.nav a:hover {
  text-decoration: none;
}

/* hero */
.hero {
  position: relative;
  max-width: 880px;
  margin: 0 auto;
  padding: 84px 24px 56px;
  text-align: center;
  overflow: visible;
}
.hero-glow {
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 720px;
  height: 420px;
  background: radial-gradient(ellipse at center, rgba(59, 130, 246, 0.18), transparent 65%);
  pointer-events: none;
}
.hero-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7fb0f9;
  background: var(--accent-soft);
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 999px;
  padding: 5px 14px;
  margin-bottom: 22px;
}
.hero h1 {
  font-size: clamp(34px, 5.5vw, 52px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  font-weight: 700;
}
.grad {
  background: linear-gradient(92deg, var(--accent) 10%, #8b5cf6 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero-sub {
  max-width: 640px;
  margin: 18px auto 0;
  font-size: 16.5px;
  line-height: 1.6;
  color: var(--text-muted);
}
.hero-sub strong {
  color: var(--text);
}
.hero-ctas {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 28px;
  flex-wrap: wrap;
}
.hero-ctas a:hover {
  text-decoration: none;
}
.btn-lg {
  padding: 11px 22px;
  font-size: 14.5px;
}
.hero-note {
  margin-top: 12px;
  font-size: 12.5px;
}
.hero-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 52px;
}
.stat {
  background: var(--panel);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: 16px 12px;
}
.stat-num {
  display: block;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}
.stat-label {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* sections */
.section {
  max-width: 1100px;
  margin: 0 auto;
  padding: 56px 24px;
}
.section-title {
  text-align: center;
  font-size: clamp(24px, 3.2vw, 32px);
  letter-spacing: -0.015em;
}
.section-sub {
  text-align: center;
  margin: 10px auto 0;
  max-width: 560px;
  font-size: 14.5px;
}

/* how it works */
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 32px;
}
.step {
  position: relative;
  padding: 22px 18px 20px;
}
.step-num {
  position: absolute;
  top: 14px;
  right: 16px;
  font-size: 30px;
  font-weight: 700;
  color: var(--border);
}
.step-icon {
  color: var(--accent);
  margin-bottom: 10px;
}
.step h3 {
  font-size: 15.5px;
  margin-bottom: 6px;
}
.step p {
  font-size: 13.5px;
  line-height: 1.55;
}

/* features */
.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 32px;
}
.feature {
  padding: 20px 18px;
}
.feature-icon {
  color: var(--accent);
  margin-bottom: 10px;
}
.feature h3 {
  font-size: 15px;
  margin-bottom: 6px;
}
.feature p {
  font-size: 13.5px;
  line-height: 1.55;
}

/* states */
.states-band {
  text-align: center;
}
.states-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 26px auto 14px;
  max-width: 760px;
}
.state-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  padding: 6px 13px;
}
.state-chip svg {
  color: var(--green);
}

/* pricing */
.pricing {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 380px));
  gap: 16px;
  justify-content: center;
  margin-top: 32px;
}
.price-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px 22px;
}
.price-card.featured {
  border-color: rgba(59, 130, 246, 0.5);
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.08), var(--panel) 55%);
}
.deal-pill {
  align-self: flex-start;
}
.price-card h3 {
  font-size: 16px;
}
.price {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.price-num {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.price-was {
  text-decoration: line-through;
  font-size: 15px;
  margin-left: 6px;
}
.price-card ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}
.price-card li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--text-muted);
}
.price-card li svg {
  color: var(--green);
  flex-shrink: 0;
}
.price-card .btn {
  justify-content: center;
}
.price-card a:hover {
  text-decoration: none;
}

/* final CTA + footer */
.final-cta {
  text-align: center;
  padding-bottom: 72px;
}
.final-cta .btn {
  margin-top: 26px;
}
.final-cta a:hover {
  text-decoration: none;
}
.footer {
  border-top: 1px solid var(--border-soft);
  padding: 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.footer p {
  max-width: 640px;
  margin: 0 auto;
}

@media (max-width: 900px) {
  .hero-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .steps,
  .features {
    grid-template-columns: 1fr;
  }
  .pricing {
    grid-template-columns: minmax(0, 420px);
  }
}
</style>
