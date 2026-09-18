<script setup lang="ts">
import { ArrowRight, Check } from 'lucide-vue-next'

/* Every figure and citation on this page is real product behavior — the playbook states,
   the escalation ladder, the boilerplate letters, the total-loss invoice lines. The letter
   itself is a sample with fictional parties. */

const states = [
  'Arkansas', 'Colorado', 'Florida', 'Illinois', 'Kansas', 'Minnesota', 'Missouri', 'Montana',
  'New Mexico', 'North Dakota', 'Ohio', 'Oklahoma', 'Tennessee', 'Texas', 'Wisconsin',
]

const docket = [
  {
    dir: '↓ Received',
    who: 'from the adjuster',
    when: 'Sep 12',
    subject: 'Please send a detailed breakdown of the supplement',
    tag: 'Redundant request',
    tagCls: 'amber',
    note: 'Intake reads the email, logs the date, and names the tactic. The breakdown was already sent twice — the record knows.',
  },
  {
    dir: '✦ Draft',
    who: 'generated for your review',
    when: 'Sep 12',
    subject: 'Re: breakdown — previously provided Aug 28 and Sep 3',
    tag: 'Firm · rung 3 of 5',
    tagCls: 'ink',
    note: 'The reply restates the dates from the case record, cites OAC 3901-1-54(H)(1) verbatim, and sets a payment deadline.',
  },
  {
    dir: '↑ Sent',
    who: 'from your own inbox',
    when: 'Sep 12',
    subject: 'Re: breakdown — previously provided Aug 28 and Sep 3',
    tag: 'On the record',
    tagCls: 'ink',
    note: 'You copy it into your email and send it yourself. Nothing leaves this platform without you.',
  },
  {
    dir: '↓ Received',
    who: 'from the adjuster',
    when: 'Sep 19',
    subject: 'Supplement approved — payment issued',
    tag: 'Paid',
    tagCls: 'green',
    note: 'Most disputes end here. If they don’t, the next draft climbs a rung — never ahead of what the record shows.',
  },
]

const letters = [
  {
    title: 'Formal directive & notice of representation',
    sender: 'Customer',
    when: 'Day one of the claim. Routes every call and every check through your shop before the insurer starts steering.',
  },
  {
    title: 'Itemized breakdown reply',
    sender: 'Shop',
    when: 'The adjuster asks for “a detailed breakdown.” You answer once, on the record, with the dates you already sent it.',
  },
  {
    title: 'Total-loss fee rebuttal',
    sender: 'Customer',
    when: 'The car totals and the insurer refuses your admin, lot, and storage fees — or deducts them from the customer’s settlement.',
  },
  {
    title: 'Fee rebuttal — owner keeps the vehicle',
    sender: 'Customer',
    when: 'Same dispute, retained-salvage version, so the numbers match what actually happened.',
  },
]

const ladder = [
  ['Cooperative reply', 'Answer the request, point to the documents, restate amounts and dates plainly.'],
  ['Documented-delivery notice', 'Comply once more if it’s trivial — but put on record when each item was already provided, and to whom.'],
  ['Firm demand', 'Decline the re-request. Set a response deadline. Summarize the dated record.'],
  ['Bad-faith notice', 'Cite the state’s claim-handling provisions, name the documented pattern, state intent to file with the regulator.'],
  ['Final notice', 'Payment by a stated date. Past this rung the assistant tells you to retain counsel instead of drafting further.'],
]

const never = [
  ['Invent a statute.', 'Drafts may cite only the attorney-reviewed library for your state, and every citation is checked against it before you see the letter. A cite that isn’t in the library doesn’t reach you.'],
  ['Accuse bad faith early.', 'The assistant won’t climb to a bad-faith notice until the case record actually documents a pattern. Rung 4 is earned, not picked.'],
  ['Send anything for you.', 'There is no “send” button. You copy the letter into your own email, from your own address, when you decide to.'],
  ['Keep drafting when you need a lawyer.', 'At the final rung it stops and says so. This is a negotiation tool, not a law firm.'],
]

const faqs = [
  {
    q: 'Is this legal advice?',
    a: 'No. DSM Negotiator prepares letters for your review and cites your state’s published claim-handling rules. You approve and send every letter, and complex disputes belong with an attorney. The state libraries were reviewed by counsel; the tool is not one.',
  },
  {
    q: 'My state isn’t on the list. Is it useless to me?',
    a: 'No — the four standard letters, the case record, the total-loss invoice, and the AI drafts all work in every state. What you don’t get yet is state-specific citations: drafts stay factual and firm without quoting a rule we haven’t verified for you. New states are added as they’re researched and reviewed.',
  },
  {
    q: 'Does it email the insurer?',
    a: 'Never. Every letter is copied into your own mailbox and sent by you. Sent letters are then logged on the case record, so the docket stays complete.',
  },
  {
    q: 'What about the customer’s letters?',
    a: 'Some leverage only the policyholder has, so several letters are written in the customer’s voice for them to send to their own insurer. Those require the customer’s recorded authorization and are never signed by the shop.',
  },
]
</script>

<template>
  <div class="landing">
    <header class="nav">
      <div class="wrap nav-inner">
        <RouterLink :to="{ name: 'welcome' }" class="brand">
          <img src="@/assets/dsm-logo.png" class="brand-logo" alt="Dent Shop Manager" />
          <span class="brand-word">
            <span class="brand-parent">Dent Shop Manager</span>
            <span class="brand-product">Negotiator</span>
          </span>
        </RouterLink>
        <nav class="nav-links">
          <a href="#how">How a case runs</a>
          <a href="#letters">What it writes</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div class="nav-right">
          <RouterLink :to="{ name: 'login' }" class="nav-login">Log in</RouterLink>
          <RouterLink :to="{ name: 'register' }" class="cta cta-sm">Start free trial</RouterLink>
        </div>
      </div>
    </header>

    <!-- ============ HERO ============ -->
    <section class="hero">
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">For hail &amp; PDR shops · state-specific in {{ states.length }} states</p>
          <h1>The adjuster’s email has a playbook. Now your reply does too.</h1>
          <p class="lede">
            Paste the adjuster’s email. Get back a letter that cites your state’s claim-handling
            rules chapter and verse, pulls every date from your own case record, and sets a
            deadline. You read it. You send it. The short pay stops being the cost of doing
            business.
          </p>
          <div class="hero-ctas">
            <RouterLink :to="{ name: 'register' }" class="cta">
              Start your free trial <ArrowRight :size="16" />
            </RouterLink>
            <a href="#how" class="link-quiet">See a case run, start to paid ↓</a>
          </div>
          <p class="hero-fine">7-day trial · every seat in your shop · no card to start</p>
        </div>

        <!-- The product is the letter, so the letter is the hero. -->
        <figure class="letter-fig" aria-label="Sample letter drafted by DSM Negotiator">
          <div class="letter">
            <div class="letter-head">
              <span class="mono">Re: Claim 24-OH-773192 · 2021 Ford F-150 · Supplement #2</span>
              <span class="letter-stamp">Firm · rung 3 of 5</span>
            </div>
            <p>Ms. Alvarez,</p>
            <p>
              We received your September 12 request for an itemized breakdown of the supplement.
              That breakdown was delivered to you on
              <mark class="date">August 28</mark> and to your field appraiser on
              <mark class="date">September 3</mark>. A third copy is attached.
            </p>
            <p>
              Under <span class="cite">OAC 3901-1-54(H)(1)</span>, when necessary repairs exceed
              your written estimate, Keystone Mutual must
              <mark class="quote">“pay the difference between the written estimate and a higher estimate obtained by the claimant or promptly provide the claimant with the name of at least one repair shop that will make the repairs for the amount of the written estimate.”</mark>
              Neither has occurred.
            </p>
            <p>
              Please issue the remaining <strong class="mono">$4,312.60</strong> by
              <strong>September 26</strong>. Further requests for documents already in your file
              will not be treated as a condition of payment.
            </p>
            <p class="letter-sig">Northline Hail &amp; PDR<br /><span>Direction to pay on file · lien retained</span></p>
          </div>
          <ul class="callouts" aria-label="What the assistant did">
            <li class="co co-1"><b>Tactic named</b> Redundant request — it was sent twice already</li>
            <li class="co co-2"><b>Dates from your record</b> not from memory</li>
            <li class="co co-3"><b>Citation verified</b> quote is verbatim from the Ohio library</li>
            <li class="co co-4"><b>Deadline set</b> the reply is a demand, not a discussion</li>
          </ul>
          <figcaption>Sample letter. Parties are fictional; the rule and its quote are real.</figcaption>
        </figure>
      </div>
    </section>

    <!-- ============ PROOF STRIP ============ -->
    <section class="proof">
      <div class="wrap proof-grid">
        <div>
          <b>Written from letters that got paid.</b>
          <span>The standard letters aren’t AI prose — they’re the exact emails a working Ohio hail shop used to collect, turned into fill-in templates.</span>
        </div>
        <div>
          <b>Only law that’s been checked.</b>
          <span>{{ states.length }} state libraries, each provision quoted from the official text, scope-marked, and signed off by an attorney.</span>
        </div>
        <div>
          <b>Nothing sends itself.</b>
          <span>You copy every letter into your own email. The platform builds the record; you stay the sender.</span>
        </div>
      </div>
    </section>

    <!-- ============ HOW A CASE RUNS ============ -->
    <section id="how" class="section">
      <div class="wrap">
        <div class="sec-head">
          <h2>How a case runs</h2>
          <p>One case, one record. Every email in, every letter out, in order — so the next letter is always built on what actually happened.</p>
        </div>
        <ol class="docket">
          <li v-for="(d, i) in docket" :key="i" class="entry">
            <span class="num mono">№{{ i + 1 }}</span>
            <div class="entry-body">
              <div class="entry-top">
                <span class="dir">{{ d.dir }} <em>· {{ d.who }}</em></span>
                <span class="when mono">{{ d.when }}</span>
              </div>
              <div class="entry-subject">
                {{ d.subject }}
                <span class="tag" :class="d.tagCls">{{ d.tag }}</span>
              </div>
              <p class="entry-note">{{ d.note }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- ============ WHAT IT WRITES ============ -->
    <section id="letters" class="section section-alt">
      <div class="wrap two-col">
        <div>
          <div class="sec-head left">
            <h2>What it writes</h2>
            <p>Four standard letters every case can generate in seconds, filled from the case sheet. Then the assistant takes over, one rung at a time.</p>
          </div>
          <table class="doc-table">
            <thead>
              <tr><th>Letter</th><th>Sent by</th></tr>
            </thead>
            <tbody>
              <tr v-for="l in letters" :key="l.title">
                <td>
                  <b>{{ l.title }}</b>
                  <span>{{ l.when }}</span>
                </td>
                <td class="mono sender">{{ l.sender }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div class="sec-head left">
            <h2>The escalation ladder</h2>
            <p>When the insurer keeps stalling, the AI drafts climb these rungs — and tell you which one you’re on.</p>
          </div>
          <ol class="ladder">
            <li v-for="([name, desc], i) in ladder" :key="name">
              <span class="rung mono">{{ i + 1 }}</span>
              <div><b>{{ name }}</b><span>{{ desc }}</span></div>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <!-- ============ TOTAL LOSS ============ -->
    <section class="section">
      <div class="wrap two-col tl">
        <div class="tl-copy">
          <div class="sec-head left">
            <h2>When the car totals, your fees don’t vanish</h2>
            <p>
              Hail shops lose the most money on total losses: the insurer takes weeks to inspect,
              declares the car a loss, then refuses the admin fee, the lot fee, and every day of
              storage. The invoice below is generated from your rates and your dates — storage
              keeps accruing until the car is released — and the matching rebuttal letter cites the
              rule that says they owe it.
            </p>
          </div>
          <ul class="ticks">
            <li><Check :size="15" /> Your shop’s default fees, overridable per case</li>
            <li><Check :size="15" /> Storage counted inclusively, date to date, live</li>
            <li><Check :size="15" /> Invoice PDF and the rebuttal letter from the same numbers</li>
          </ul>
        </div>
        <div class="invoice">
          <div class="inv-head">
            <span>Total loss invoice</span>
            <span class="mono">Claim 24-OH-773192</span>
          </div>
          <table>
            <tbody>
              <tr><td>Administrative forensic blueprinting fee</td><td class="mono">$2,750.00</td></tr>
              <tr><td>Lot fee</td><td class="mono">$1,500.00</td></tr>
              <tr>
                <td>Accrued commercial storage<br /><span>5/24 through 6/4 · 12 days @ $125.00/day</span></td>
                <td class="mono">$1,500.00</td>
              </tr>
              <tr><td>Sales tax · 7.25%</td><td class="mono">$416.88</td></tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Current total recovery balance for asset release</td>
                <td class="mono total">$6,166.88</td>
              </tr>
            </tfoot>
          </table>
          <div class="inv-foot">
            <span class="accrue"><i></i> Storage accruing · +$125.00 tomorrow</span>
            <span class="mono">PDF</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ GUARDRAILS ============ -->
    <section class="section section-alt">
      <div class="wrap">
        <div class="sec-head">
          <h2>What it will never do</h2>
          <p>An adjuster reads a letter looking for the mistake that lets them ignore it. These are the ways the tool keeps you from handing them one.</p>
        </div>
        <div class="never">
          <div v-for="([head, body]) in never" :key="head">
            <b>{{ head }}</b>
            <p>{{ body }}</p>
          </div>
        </div>
        <p class="states">
          <span class="states-lbl">State libraries today</span>
          <span v-for="s in states" :key="s" class="state">{{ s }}</span>
        </p>
      </div>
    </section>

    <!-- ============ PRICING ============ -->
    <section id="pricing" class="section">
      <div class="wrap">
        <div class="sec-head">
          <h2>One recovered supplement pays for the year</h2>
          <p>Flat annual price per shop location. Every seat included. No per-letter charges.</p>
        </div>
        <div class="pricing">
          <div class="plan">
            <h3>DSM Negotiator</h3>
            <div class="price"><span class="amt">$1,999</span><span>/ year</span></div>
            <ul class="ticks">
              <li><Check :size="15" /> Unlimited cases, letters, and team seats</li>
              <li><Check :size="15" /> AI drafting with state-specific citations</li>
              <li><Check :size="15" /> Email intake (.eml or paste), tactic tagging</li>
              <li><Check :size="15" /> Case record, total-loss invoices, document vault</li>
            </ul>
            <RouterLink :to="{ name: 'register' }" class="cta cta-block">Start free trial</RouterLink>
          </div>
          <div class="plan plan-bundle">
            <span class="plan-tag">Already on Dent Shop Manager?</span>
            <h3>Bundle price</h3>
            <div class="price"><span class="amt">$999</span><span>/ year</span><s class="mono">$1,999</s></div>
            <ul class="ticks">
              <li><Check :size="15" /> Everything in DSM Negotiator</li>
              <li><Check :size="15" /> Half price with an active DSM subscription</li>
              <li><Check :size="15" /> Cases link to the claims and customers you already have</li>
            </ul>
            <RouterLink :to="{ name: 'register' }" class="cta cta-block">Start free trial</RouterLink>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ FAQ ============ -->
    <section class="section section-alt">
      <div class="wrap faq-wrap">
        <h2>Straight answers</h2>
        <div class="faq">
          <details v-for="f in faqs" :key="f.q">
            <summary>{{ f.q }}</summary>
            <p>{{ f.a }}</p>
          </details>
        </div>
      </div>
    </section>

    <!-- ============ FINAL ============ -->
    <section class="final">
      <div class="wrap">
        <h2>The insurer runs your claim through software.<br />Run your reply through a negotiator.</h2>
        <RouterLink :to="{ name: 'register' }" class="cta">
          Create your shop <ArrowRight :size="16" />
        </RouterLink>
        <p class="hero-fine">Built by the team behind Dent Shop Manager, the CRM hail shops already run their claims on.</p>
      </div>
    </section>

    <footer class="footer">
      <div class="wrap">
        <p>
          DSM Negotiator is not a law firm and does not provide legal advice. Letters are prepared
          for your review — you approve and send every one — and disputes headed for litigation
          belong with an attorney.
        </p>
        <p>© {{ new Date().getFullYear() }} Dent Shop Manager</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* A marketing page in one deliberate world: paper, ink, and a single red — the parent
   logo's red — spent on the one action that matters. It overrides the app's theme tokens
   locally so global .btn/.card styles inside still resolve correctly. */
.landing {
  --paper: #f4f5f7;
  --paper-2: #ebedf1;
  --sheet: #ffffff;
  --ink: #15171c;
  --ink-2: #4c525e;
  --ink-3: #8a909c;
  --rule: #d6d9e0;
  --rule-strong: #b9bec9;
  --red: #c8281e;
  --red-deep: #a51f17;
  --green: #1f7f48;
  --amber: #9a5b00;
  --marker: #fff2a8;
  --disp: 'Bricolage Grotesque', 'Instrument Sans', system-ui, sans-serif;
  --serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;

  --bg: var(--paper);
  --text: var(--ink);
  --text-muted: var(--ink-2);
  --text-faint: var(--ink-3);
  --border: var(--rule-strong);
  --border-soft: var(--rule);
  --panel: var(--sheet);

  flex: 1;
  background: var(--paper);
  color: var(--ink);
  color-scheme: light;
  font-size: 15.5px;
}
.wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
}
.mono {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
h1, h2, h3 {
  font-family: var(--disp);
  letter-spacing: -0.022em;
  text-wrap: balance;
}
.landing a:hover {
  text-decoration: none;
}

/* ---- calls to action ---- */
.cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--red);
  color: #fff;
  border-radius: 6px;
  padding: 13px 22px;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.005em;
  transition: background 0.15s, transform 0.15s;
}
.cta:hover {
  background: var(--red-deep);
  color: #fff;
}
.cta:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}
.cta-sm {
  padding: 8px 14px;
  font-size: 13.5px;
}
.cta-block {
  justify-content: center;
  width: 100%;
}
.link-quiet {
  color: var(--ink-2);
  font-weight: 500;
  border-bottom: 1px solid var(--rule-strong);
  padding-bottom: 1px;
}
.link-quiet:hover {
  color: var(--ink);
  border-color: var(--ink);
}

/* ---- nav ---- */
.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(244, 245, 247, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--rule);
}
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 64px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
}
.brand-logo {
  height: 36px;
  width: auto;
}
.brand-word {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.brand-parent {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.brand-product {
  font-family: var(--disp);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.01em;
}
.nav-links {
  display: flex;
  gap: 26px;
}
.nav-links a {
  color: var(--ink-2);
  font-weight: 500;
  font-size: 14px;
}
.nav-links a:hover {
  color: var(--ink);
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 18px;
}
.nav-login {
  color: var(--ink);
  font-weight: 600;
  font-size: 14px;
}

/* ---- hero ---- */
.hero {
  padding: 72px 0 64px;
  border-bottom: 1px solid var(--rule);
  background:
    linear-gradient(180deg, var(--sheet) 0%, var(--paper) 100%);
}
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 56px;
  align-items: center;
}
.eyebrow {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--red);
  margin-bottom: 18px;
}
.hero h1 {
  font-size: clamp(34px, 4.4vw, 54px);
  line-height: 1.02;
  font-weight: 700;
  margin-bottom: 22px;
}
.lede {
  font-size: 17.5px;
  line-height: 1.55;
  color: var(--ink-2);
  max-width: 34em;
}
.hero-ctas {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  margin-top: 30px;
}
.hero-fine {
  margin-top: 14px;
  font-size: 13px;
  color: var(--ink-3);
}

/* the letter */
.letter-fig {
  margin: 0;
  position: relative;
  padding-right: 24px;
}
.letter {
  background: var(--sheet);
  border: 1px solid var(--rule-strong);
  box-shadow:
    0 1px 0 rgba(21, 23, 28, 0.04),
    0 24px 48px -28px rgba(21, 23, 28, 0.35);
  padding: 30px 34px 26px;
  font-family: var(--serif);
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--ink);
}
.letter p {
  margin-bottom: 12px;
}
.letter-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  border-bottom: 1px solid var(--rule);
  padding-bottom: 12px;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--ink-2);
}
.letter-stamp {
  flex-shrink: 0;
  font-family: var(--font);
  font-weight: 700;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--red);
  border: 1.5px solid var(--red);
  border-radius: 3px;
  padding: 2px 7px;
  transform: rotate(-2deg);
}
.cite {
  font-family: var(--mono);
  font-size: 12.5px;
  font-weight: 500;
  background: var(--paper-2);
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}
mark.date {
  background: none;
  color: inherit;
  border-bottom: 2px solid var(--red);
  padding-bottom: 1px;
}
mark.quote {
  background: var(--marker);
  color: inherit;
  padding: 0 2px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.letter-sig {
  margin: 18px 0 0;
  font-weight: 600;
}
.letter-sig span {
  font-weight: 400;
  font-size: 12.5px;
  color: var(--ink-2);
}
.callouts {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
}
.co {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--ink-2);
  padding-left: 12px;
  border-left: 2px solid var(--red);
}
.co b {
  display: block;
  color: var(--ink);
  font-weight: 600;
}
.letter-fig figcaption {
  margin-top: 12px;
  font-size: 12px;
  color: var(--ink-3);
}

/* ---- proof strip ---- */
.proof {
  background: var(--ink);
  color: #e9ebf0;
}
.proof-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
}
.proof-grid > div {
  padding: 26px 28px 26px 0;
  margin-right: 28px;
  border-right: 1px solid rgba(255, 255, 255, 0.14);
}
.proof-grid > div:last-child {
  border-right: 0;
  margin-right: 0;
  padding-right: 0;
}
.proof-grid b {
  display: block;
  font-family: var(--disp);
  font-size: 17px;
  letter-spacing: -0.01em;
  margin-bottom: 6px;
  color: #fff;
}
.proof-grid span {
  font-size: 13.5px;
  line-height: 1.5;
  color: #b4b9c4;
}

/* ---- sections ---- */
.section {
  padding: 80px 0;
}
.section-alt {
  background: var(--sheet);
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}
.sec-head {
  text-align: center;
  max-width: 640px;
  margin: 0 auto 44px;
}
.sec-head.left {
  text-align: left;
  margin: 0 0 28px;
}
.sec-head h2 {
  font-size: clamp(28px, 3.2vw, 38px);
  line-height: 1.08;
  font-weight: 700;
  margin-bottom: 14px;
}
.sec-head p {
  color: var(--ink-2);
  font-size: 16px;
  line-height: 1.55;
}
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: start;
}

/* docket */
.docket {
  list-style: none;
  margin: 0 auto;
  padding: 0;
  max-width: 760px;
  position: relative;
}
.docket::before {
  content: '';
  position: absolute;
  left: 27px;
  top: 12px;
  bottom: 12px;
  width: 1px;
  background: var(--rule-strong);
}
.entry {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 16px;
  padding: 0 0 30px;
  position: relative;
}
.entry:last-child {
  padding-bottom: 0;
}
.num {
  position: relative;
  z-index: 1;
  width: 56px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-2);
}
.entry-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12.5px;
  color: var(--ink-3);
  padding-top: 5px;
}
.dir {
  font-weight: 600;
  color: var(--ink);
}
.dir em {
  font-style: normal;
  font-weight: 400;
  color: var(--ink-3);
}
.entry-subject {
  font-family: var(--serif);
  font-size: 17px;
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.tag {
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid currentColor;
}
.tag.amber {
  color: var(--amber);
}
.tag.ink {
  color: var(--ink-2);
}
.tag.green {
  color: var(--green);
}
.entry-note {
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 14.5px;
  line-height: 1.5;
  max-width: 56ch;
}

/* letters table + ladder */
.doc-table {
  width: 100%;
  border-collapse: collapse;
  border-top: 1px solid var(--ink);
}
.doc-table th {
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
  padding: 10px 0;
  border-bottom: 1px solid var(--rule);
}
.doc-table td {
  padding: 14px 0;
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
}
.doc-table td b {
  display: block;
  font-weight: 600;
  margin-bottom: 3px;
}
.doc-table td span {
  font-size: 13.5px;
  color: var(--ink-2);
  line-height: 1.45;
}
.doc-table .sender {
  width: 92px;
  font-size: 12.5px;
  color: var(--ink-2);
  padding-left: 16px;
  padding-top: 16px;
}
.ladder {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--ink);
}
.ladder li {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--rule);
}
.rung {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ink);
  border-radius: 999px;
  font-size: 12px;
}
.ladder li:nth-child(4) .rung,
.ladder li:nth-child(5) .rung {
  background: var(--ink);
  color: #fff;
}
.ladder b {
  display: block;
  font-weight: 600;
  margin-bottom: 3px;
}
.ladder span {
  font-size: 13.5px;
  color: var(--ink-2);
  line-height: 1.45;
}

/* total loss */
.tl {
  align-items: center;
}
.ticks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ticks li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 14.5px;
  color: var(--ink-2);
}
.ticks svg {
  flex-shrink: 0;
  color: var(--green);
  margin-top: 3px;
}
.invoice {
  background: var(--sheet);
  border: 1px solid var(--rule-strong);
  box-shadow: 0 24px 48px -32px rgba(21, 23, 28, 0.35);
  padding: 22px 26px;
}
.inv-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ink);
}
.invoice table {
  width: 100%;
  border-collapse: collapse;
}
.invoice td {
  padding: 11px 0;
  border-bottom: 1px solid var(--rule);
  font-size: 14px;
  vertical-align: top;
}
.invoice td:last-child {
  text-align: right;
  white-space: nowrap;
}
.invoice td span {
  font-size: 12px;
  color: var(--ink-3);
}
.invoice tfoot td {
  border-bottom: 0;
  padding-top: 14px;
  font-weight: 600;
}
.invoice .total {
  font-size: 22px;
  font-weight: 500;
}
.inv-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
  font-size: 12.5px;
  color: var(--ink-3);
}
.accrue {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--green);
  font-weight: 600;
}
.accrue i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 3px rgba(31, 127, 72, 0.18);
}

/* guardrails */
.never {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 28px 56px;
  max-width: 900px;
  margin: 0 auto;
}
.never > div {
  border-top: 1px solid var(--ink);
  padding-top: 14px;
}
.never b {
  display: block;
  font-family: var(--disp);
  font-size: 19px;
  letter-spacing: -0.01em;
  margin-bottom: 8px;
}
.never p {
  color: var(--ink-2);
  font-size: 14.5px;
  line-height: 1.5;
}
.states {
  max-width: 900px;
  margin: 44px auto 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.states-lbl {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-right: 8px;
}
.state {
  font-size: 13px;
  padding: 3px 10px;
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  color: var(--ink-2);
  background: var(--sheet);
}

/* pricing */
.pricing {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 400px));
  gap: 20px;
  justify-content: center;
}
.plan {
  background: var(--sheet);
  border: 1px solid var(--rule-strong);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.plan-bundle {
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink);
}
.plan-tag {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--red);
}
.plan h3 {
  font-size: 18px;
  font-weight: 700;
}
.price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--ink-2);
}
.amt {
  font-family: var(--disp);
  font-size: 44px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--ink);
  line-height: 1;
}
.price s {
  color: var(--ink-3);
  font-size: 14px;
  margin-left: 6px;
}
.plan .ticks {
  flex: 1;
}

/* faq */
.faq-wrap {
  max-width: 720px;
}
.faq-wrap h2 {
  font-size: clamp(28px, 3.2vw, 38px);
  margin-bottom: 20px;
}
.faq details {
  border-top: 1px solid var(--rule);
}
.faq details:last-child {
  border-bottom: 1px solid var(--rule);
}
.faq summary {
  cursor: pointer;
  list-style: none;
  padding: 18px 32px 18px 0;
  font-weight: 600;
  font-size: 16.5px;
  position: relative;
}
.faq summary::-webkit-details-marker {
  display: none;
}
.faq summary::after {
  content: '+';
  position: absolute;
  right: 4px;
  top: 14px;
  font-size: 22px;
  font-weight: 300;
  color: var(--ink-3);
}
.faq details[open] summary::after {
  content: '–';
}
.faq summary:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}
.faq p {
  padding: 0 0 20px;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.55;
  max-width: 62ch;
}

/* final + footer */
.final {
  padding: 88px 0 96px;
  text-align: center;
}
.final h2 {
  font-size: clamp(28px, 3.6vw, 44px);
  line-height: 1.08;
  font-weight: 700;
  margin-bottom: 28px;
}
.final .hero-fine {
  margin-top: 18px;
}
.footer {
  border-top: 1px solid var(--rule);
  padding: 28px 0 36px;
  font-size: 12.5px;
  color: var(--ink-3);
}
.footer p {
  max-width: 68ch;
}
.footer p + p {
  margin-top: 10px;
}

/* ---- responsive ---- */
@media (max-width: 960px) {
  .hero-grid,
  .two-col {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  .letter-fig {
    padding-right: 0;
  }
  .nav-links {
    display: none;
  }
  .proof-grid {
    grid-template-columns: 1fr;
  }
  .proof-grid > div {
    padding: 18px 0;
    margin: 0;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  }
  .proof-grid > div:last-child {
    border-bottom: 0;
  }
  .never,
  .callouts {
    grid-template-columns: 1fr;
  }
  .pricing {
    grid-template-columns: minmax(0, 440px);
  }
}
@media (max-width: 560px) {
  .landing {
    font-size: 15px;
  }
  .hero {
    padding: 44px 0 48px;
  }
  .section {
    padding: 56px 0;
  }
  .letter {
    padding: 20px 18px;
    font-size: 13.5px;
  }
  .nav-login {
    display: none;
  }
  .entry {
    grid-template-columns: 44px 1fr;
    gap: 12px;
  }
  .num {
    width: 44px;
    font-size: 11px;
  }
  .docket::before {
    left: 21px;
  }
  .entry-top {
    flex-direction: column;
    gap: 2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cta {
    transition: none;
  }
}
</style>
