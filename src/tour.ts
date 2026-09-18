import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './styles/tour.css'

// Mirrors the Dent Shop Manager tour pattern: driver.js pointed at [data-tour] anchors,
// auto-run once per browser via a localStorage flag, replayable from the topbar help button.
// Every popover carries a "Don't show again" button that marks the tour seen and closes it.

const CASES_KEY = 'dsm_neg_tour_done_v1'
const WORKSPACE_KEY = 'dsm_neg_ws_tour_done_v1'

export const casesTourSeen = () => localStorage.getItem(CASES_KEY) === '1'
const markCasesTourSeen = () => localStorage.setItem(CASES_KEY, '1')

export const workspaceTourSeen = () => localStorage.getItem(WORKSPACE_KEY) === '1'
const markWorkspaceTourSeen = () => localStorage.setItem(WORKSPACE_KEY, '1')

function shared(markSeen: () => void) {
  let instance: Driver | null = null
  const config = {
    showProgress: true,
    overlayOpacity: 0.6,
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Finish',
    onDestroyed: markSeen,
    onPopoverRender: (popover: { footerButtons: HTMLElement }) => {
      const btn = document.createElement('button')
      btn.innerText = "Don't show again"
      btn.className = 'driver-popover-btn-disable'
      btn.addEventListener('click', () => {
        markSeen()
        instance?.destroy()
      })
      popover.footerButtons.prepend(btn)
    },
  }
  return {
    config,
    setInstance: (d: Driver) => {
      instance = d
    },
  }
}

export function startCasesTour() {
  const { config, setInstance } = shared(markCasesTourSeen)
  const d = driver({
    ...config,
    steps: [
      {
        popover: {
          title: 'Welcome to DSM Negotiator 👋',
          description:
            'Your co-pilot against insurer short pays and stall tactics. Here’s the 45-second lay of the land — replay it anytime from the ? button up top.',
        },
      },
      {
        element: '[data-tour="new-case"]',
        popover: {
          title: 'One case per claim',
          description:
            'Start a case for every insurance claim — pick the customer from your DSM and the vehicle, title, and state fill themselves.',
        },
      },
      {
        element: '[data-tour="case-list"]',
        popover: {
          title: 'Your negotiations at a glance',
          description:
            'Insurer, invoice amount, and message count for every open fight. Click any row to enter its workspace.',
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
  })
  setInstance(d)
  d.drive()
}

/** The workspace is two tabs; the tour switches them as it walks the panels. */
const setWorkspaceTab = (tab: 'case' | 'nego') =>
  window.dispatchEvent(new CustomEvent('dsm-neg-ws-tab', { detail: tab }))

export function startWorkspaceTour() {
  const { config, setInstance } = shared(markWorkspaceTourSeen)
  const d = driver({
    ...config,
    steps: [
      {
        popover: {
          title: 'Your case workspace',
          description:
            'Two tabs: the case file with its invoice and ready-to-send documents, and the negotiation — the insurer paper trail and your AI-drafted answers.',
        },
      },
      {
        element: '[data-tour="ws-documents"]',
        onHighlightStarted: () => setWorkspaceTab('case'),
        popover: {
          title: 'The invoice and your documents',
          description:
            'The Total Loss invoice with every figure editable in place — storage dates, fees, tax — plus the proven letters filled in from this case. Edit a number and everything updates; download the PDF or copy a letter and send it.',
        },
      },
      {
        element: '[data-tour="ws-sidebar"]',
        onHighlightStarted: () => setWorkspaceTab('case'),
        popover: {
          title: 'The case file',
          description:
            'Customer, vehicle, insurer, claim number. The documents rebuild themselves from whatever you save here.',
        },
      },
      {
        element: '[data-tour="ws-timeline"]',
        onHighlightStarted: () => setWorkspaceTab('nego'),
        popover: {
          title: 'The negotiation tab',
          description:
            'Paste or upload the insurer’s email — we read it, name the tactic, and draft your reply automatically. Newest messages sit at the top; this timeline is your evidence.',
        },
      },
      {
        element: '[data-tour="ws-draft"]',
        onHighlightStarted: () => setWorkspaceTab('nego'),
        popover: {
          title: 'Need something custom?',
          description:
            'When the insurer sends something the prebuilt letters don’t cover, generate new correspondence here — as the shop or in your customer’s voice. You review before anything is sent.',
        },
      },
    ],
  })
  setInstance(d)
  d.drive()
}
