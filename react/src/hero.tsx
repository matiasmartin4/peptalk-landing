/* peptalk — pila de fichas destacadas del hero (Card swap de Bencho).
   app.js arma la cara de cada ficha con los mismos helpers del resto del sitio
   (window.PT.spotCards) y este archivo la monta en #spot. */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CardSwap, swapSize } from "./components/CardSwap";

type SpotCard = { id: string; title: string; html: string };
declare global { interface Window { PT: { spotCards?: SpotCard[] } } }

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function HeroSwap({ cards }: { cards: SpotCard[] }) {
  const { w, h } = swapSize(cards.length);
  const box = useRef<HTMLDivElement>(null);
  const control = useRef<null | { next: () => void }>(null);
  const [scale, setScale] = useState(1);
  const [front, setFront] = useState(cards[0].id);

  /* en pantallas angostas el bloque entero se achica, no se recorta */
  useEffect(() => {
    const el = box.current!.parentElement!;
    const fit = () => setScale(Math.min(1, el.clientWidth / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  const i = cards.findIndex((c) => c.id === front);
  return (
    <>
      <div ref={box} className="spot-stack" style={{ width: w * scale, height: h * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <CardSwap
            cards={cards.map((c) => ({ id: c.id, title: c.title, face: <div dangerouslySetInnerHTML={{ __html: c.html }} /> }))}
            auto={!reduce}
            every={6}
            onFront={setFront}
            control={control}
          />
        </div>
      </div>
      <div className="spot-controls">
        <span className="spot-count" aria-live="polite">
          <b>{cards[i].title}</b> · {i + 1} de {cards.length}
        </span>
        <button type="button" className="spot-next" onClick={() => control.current?.next()}>
          Siguiente ficha
        </button>
      </div>
    </>
  );
}

const mount = document.getElementById("spot");
const cards = window.PT && window.PT.spotCards;
if (mount && cards && cards.length) createRoot(mount).render(<HeroSwap cards={cards} />);
