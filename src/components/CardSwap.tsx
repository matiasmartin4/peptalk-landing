import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/* ══ Card swap ════════════════════════════════════════════
   A stack of photo cards in depth, each a step further back and up
   to the right, slanted. Press the front card, or drag and fling it,
   and it goes straight to the back while the rest step forward.
   With Auto on it also does that by itself every few seconds,
   pausing while a pointer is on the stack.

   ── A CARD IS ITS SLOT ──────────────────────────────────
   The order is the only state: which card is in front, which is
   behind it. A slot is a fixed transform, so moving a card is
   changing its slot and letting the transition carry it — the card
   sent back takes the back slot's paint order AT ONCE and travels
   there behind the others. That needs the paint order to be the
   z-index and not the depth, so the stage is flat (no preserve-3d)
   and the perspective sits on the stage itself, aimed at the
   block's middle as it was when it sat on .csw.

   From Bencho's Card swap (MIT, bencho.dev/licence). In peptalk the
   cards are featured profiles, not photos: they come in as props, a
   link on the card keeps its click, and only the front card can be
   read or tabbed into. */

/* sized for a profile card instead of a 196 × 246 photo: the steps are
   smaller than the original's (34 / 26 / 70) so four cards of this width
   still fit the hero column */
const CW = 352;
const CH = 304;
const STEP_X = 26;
const STEP_Y = 20;
const STEP_Z = 60;
const LEFT = 30; // where the stage sits in the block
const BOTTOM = 24;
/* skewY(6deg) lifts the far edge by CW · tan 6°; the block makes room for it */
const SLANT = Math.ceil(CW * Math.tan((6 * Math.PI) / 180));

export type SwapCard = { id: string; title: string; face: ReactNode };

/* the block's size for n cards: room for the front card plus the stack's climb and the slant */
export const swapSize = (n: number) => ({
  w: LEFT + CW + (n - 1) * STEP_X + LEFT,
  h: BOTTOM + CH + (n - 1) * STEP_Y + SLANT + 8,
});

const slot = (k: number) =>
  `translate3d(${k * STEP_X}px, ${-k * STEP_Y}px, ${-k * STEP_Z}px) skewY(6deg)`;

export function CardSwap({
  cards,
  /* off by default: a stack that reshuffles itself on a timer is a
     thing that keeps moving while you are reading the page */
  auto = false,
  /* seconds between swaps, when it is on */
  every = 4,
  onFront,
  control,
}: {
  cards: SwapCard[];
  auto?: boolean;
  every?: number;
  onFront?: (id: string) => void;
  /* a button outside the stack can send the front card back (keyboards have no drag) */
  control?: { current: null | { next: () => void } };
}) {
  const { w: W, h: H } = swapSize(cards.length);
  const [order, setOrder] = useState(cards.map((c) => c.id));
  const els = useRef<Record<string, HTMLDivElement | null>>({});
  const st = useRef({ hover: false, focus: false, drag: null as null | { id: string; real: boolean; pid: number; x: number; y: number; dx: number; dy: number; t: number } });

  useEffect(() => { onFront?.(order[0]); }, [order, onFront]);

  /* send the front card to the back: it takes the back slot now, from
     wherever it is — the front slot, or where a drag left it */
  /* every card goes back to its slot: no drag survives a swap, so a
     card can never be left holding where a hand once put it */
  const settle = () => {
    for (const el of Object.values(els.current)) if (el) { el.style.transition = ""; el.style.transform = ""; }
  };

  const swap = () => {
    settle();
    setOrder((o) => [...o.slice(1), o[0]]);
  };
  if (control) control.current = { next: swap };

  /* ── the drag ────────────────────────────────────────────
     Only the card that was grabbed moves, and the window hears the
     gesture, so it cannot be lost off the edge of the block or picked
     up by a card the pointer passes over. A real press takes over from
     a scripted one. Past a little way the card is on a rubber band, so
     a long drag cannot carry it out of the block. */
  const unhook = useRef(() => {});
  useEffect(() => () => unhook.current(), []);
  const grab = (e: React.PointerEvent<HTMLDivElement>, id: string, front: boolean) => {
    const s = st.current;
    if (s.drag && e.nativeEvent.isTrusted && !s.drag.real) { unhook.current(); s.drag = null; settle(); }
    if (!front || s.drag || e.button !== 0) return;
    /* links and buttons on the card keep their own click */
    if ((e.target as HTMLElement).closest("a, button")) return;
    const el = e.currentTarget;
    s.drag = { id, real: e.nativeEvent.isTrusted, pid: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, t: performance.now() };
    el.style.transition = "none";
    const rub = (d: number) => 160 * Math.tanh(d / 160);
    const mine = (ev: PointerEvent) => !!s.drag && ev.pointerId === s.drag.pid && ev.isTrusted === s.drag.real;
    const mv = (ev: PointerEvent) => {
      if (!mine(ev) || !s.drag) return;
      const d = s.drag;
      d.dx = ev.clientX - d.x;
      d.dy = ev.clientY - d.y;
      const x = rub(d.dx), y = rub(d.dy);
      el.style.transform = `${slot(0)} translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(x * 0.05).toFixed(2)}deg)`;
    };
    const up = (ev: PointerEvent) => {
      if (!mine(ev) || !s.drag) return;
      const d = s.drag;
      s.drag = null;
      unhook.current();
      const far = Math.hypot(d.dx, d.dy);
      const quick = far / Math.max(1, performance.now() - d.t) > 0.6;
      /* a press, or a drag far or quick enough: to the back */
      if (ev.type !== "pointercancel" && (far < 6 || far > 70 || (quick && far > 24))) { swap(); return; }
      /* not far enough: it springs back into the front slot */
      settle();
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    unhook.current = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      unhook.current = () => {};
    };
  };

  /* the timer: one swap every few seconds, unless a hand is on it
     (a keyboard on the front card's link counts as a hand) */
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (!st.current.hover && !st.current.focus && !st.current.drag && !document.hidden) swap();
    }, Math.max(1.5, every) * 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, every, order]);

  return (
    <div
      className="csw"
      style={{ width: W, height: H }}
      onPointerEnter={() => { st.current.hover = true; }}
      onPointerLeave={() => { st.current.hover = false; }}
      onFocus={() => { st.current.focus = true; }}
      onBlur={() => { st.current.focus = false; }}
    >
      <div
        className="csw-stage"
        /* aimed at the block's middle, measured from the stage */
        style={{ width: CW, height: CH, left: LEFT, bottom: BOTTOM, perspectiveOrigin: `${W / 2 - LEFT}px ${CH + BOTTOM - H / 2}px` }}
      >
        {cards.map((c) => {
          const k = order.indexOf(c.id);
          const front = k === 0;
          return (
            <div
              key={c.id}
              ref={(el) => { els.current[c.id] = el; }}
              className="csw-card"
              data-front={front || undefined}
              aria-hidden={!front}
              /* only the front card can be read or tabbed into */
              {...(!front && { inert: "" })}
              /* the slot is a variable the stylesheet turns into the
                 transform; the drag writes the transform itself, which
                 wins until it is cleared */
              style={{
                zIndex: cards.length - k,
                ["--t" as string]: slot(k),
              }}
              onPointerDown={(e) => grab(e, c.id, front)}
            >
              <div className="csw-face">{c.face}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
