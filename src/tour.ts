import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './styles/tour.css'

// Mirrors the Dent Shop Manager tour pattern: driver.js pointed at [data-tour] anchors,
// auto-run once per browser via a localStorage flag, replayable from the topbar help button.

const CASES_KEY = 'dsm_neg_tour_done_v1'
const WORKSPACE_KEY = 'dsm_neg_ws_tour_done_v1'

export const casesTourSeen = () => localStorage.getItem(CASES_KEY) === '1'
const markCasesTourSeen = () => localStorage.setItem(CASES_KEY, '1')

export const workspaceTourSeen = () => localStorage.getItem(WORKSPACE_KEY) === '1'
const markWorkspaceTourSeen = () => localStorage.setItem(WORKSPACE_KEY, '1')

const shared = {
  showProgress: true,
  overlayOpacity: 0.6,
  nextBtnText: 'Next →',
  prevBtnText: '← Back',
  doneBtnText: 'Finish',
}

export function startCasesTour() {
  driver({
    ...shared,
    onDestroyed: markCasesTourSeen,
    steps: [
      {
        popover: {
          title: 'Welcome to DSM Negotiator 👋',
          description:
            'Your AI co-pilot against insurer short pays and stall tactics. Here’s the 45-second lay of the land — you can replay this anytime from the ? button up top.',
        },
      },
      {
        element: '[data-tour="new-case"]',
        popover: {
          title: 'One case per claim',
          description:
            'Start a case for every insurance claim you’re negotiating — the customer, insurer, claim number, and invoice total live here.',
        },
      },
      {
        element: '[data-tour="case-list"]',
        popover: {
          title: 'Your negotiations at a glance',
          description:
            'Status, insurer, invoice amount, and message count for every open fight. Click any row to enter its workspace.',
        },
      },
      {
        element: '[data-tour="help"]',
        popover: {
          title: 'Lost? Start here',
          description:
            'This button replays the walkthrough. Opening your first case starts a short tour of the workspace itself.',
        },
      },
    ],
  }).drive()
}

export function startWorkspaceTour() {
  driver({
    ...shared,
    onDestroyed: markWorkspaceTourSeen,
    steps: [
      {
        popover: {
          title: 'Your case workspace',
          description:
            'Everything for this claim lives on one screen: the case file, the message timeline, and the AI tools.',
        },
      },
      {
        element: '[data-tour="ws-sidebar"]',
        popover: {
          title: 'The case file',
          description:
            'Facts, amounts, and documents. The AI only argues from what’s recorded here — the more complete your ledger, the stronger every letter.',
        },
      },
      {
        element: '[data-tour="ws-timeline"]',
        popover: {
          title: 'The paper trail',
          description:
            'Forward or drag the insurer’s .eml emails in and log your replies. Dates land on the ledger automatically — this timeline is your evidence.',
        },
      },
      {
        element: '[data-tour="ws-draft"]',
        popover: {
          title: 'AI-drafted responses',
          description:
            'Pick an escalation tier and get a letter grounded in your facts, citing your state’s verified insurance law. Every citation is validated — and you review before anything is sent.',
        },
      },
      {
        element: '[data-tour="ws-copilot"]',
        popover: {
          title: 'Ask the copilot',
          description:
            '“What’s my next move?” — the copilot reads the whole case and answers with state-specific strategy.',
        },
      },
    ],
  }).drive()
}
