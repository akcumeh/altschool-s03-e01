# Kay's Kitchen - Frontend

Chat UI for the Kay's Kitchen restaurant ordering bot. Built with Next.js 16 App Router.

Live: _deploy URL goes here once the Vercel frontend project is set up_

Backend repo: [`backend/`](../backend) - NestJS API at [`https://kays-kitchen-kappa.vercel.app`](https://kays-kitchen-kappa.vercel.app/health)

---

## Stack

- **Next.js 16** (App Router): React 19, TypeScript
- **Tailwind CSS v4**
- **Inter** (Google Fonts): body text
- **Monaspace Neon** (self-hosted): chat header title

## Design

Dark charcoal/pink/cream palette. On desktop the app renders as a 390×760 phone frame centred on an Iron Grey background. On mobile it fills the viewport.

| Token | Hex | Used for |
|---|---|---|
| Iron Grey | `#3f4347` | Page bg, header, bot bubbles |
| Charcoal | `#575b5f` | Email input bar |
| Cotton Candy | `#ff9eb6` | Accents, borders, CTAs, typing dots |
| Almond Cream | `#f5e3d3` | Keypad zone, user bubbles |
| Old Lace | `#fff6e8` | Chat area, keypad button faces |

## Component structure

```
src/
├── app/
│   ├── layout.tsx                # Phone-frame shell, fonts, metadata
│   ├── page.tsx                  # Chat state machine, message list
│   ├── globals.css               # Tailwind theme + CSS variables
│   └── payment-success/
│       └── page.tsx              # Paystack callback: injects confirmation then redirects home
├── components/
│   ├── ChatHeader.tsx            # Logo, Monaspace title, GitHub link
│   ├── BotBubble.tsx             # Plain text / menu card / receipt card / Paystack CTA
│   ├── UserBubble.tsx            # Almond Cream bubble with Cotton Candy border
│   ├── TypingIndicator.tsx       # Animated Cotton Candy dots
│   ├── Keypad.tsx                # 5-button idle layout; switches to n-item menu mode
│   ├── EmailInputBar.tsx         # Replaces keypad when email input is expected
│   └── PaymentModal.tsx          # Paystack payment handler overlay
├── lib/
│   └── chatParsing.ts            # Parse menus, receipts, Paystack URLs; infer chat state
└── types/
    └── chat.ts                   # Shared types: Message, ChatState, MenuItem, OrderItem
```

## Running locally

```bash
cd frontend
npm install
```

Create a `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) (Next.js picks an open port if 3000 is taken by the backend).

The backend must be running at the URL set in `NEXT_PUBLIC_API_URL`. See [`README.md`](../README.md) for backend setup.

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the NestJS backend (no trailing slash) |

## Author

- Website: [Angel Umeh | Software Engineer](https://angelumeh.dev)
- GitHub: [akcumeh](https://github.com/akcumeh)
- Twitter: [@akcumeh](https://x.com/akcumeh)
