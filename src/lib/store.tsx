/* Estado compartido entre secciones: lo que el buscador del hero o el mapa del cuerpo le
   piden a la biblioteca, y el péptido que la ficha le pasa al formulario de derivación. */
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type Store = {
  libQuery: string; setLibQuery: (q: string) => void;
  libSys: string; setLibSys: (s: string) => void;
  refPep: string; setRefPep: (p: string) => void;
};
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [libQuery, setLibQuery] = useState("");
  const [libSys, setLibSys] = useState("all");
  const [refPep, setRefPep] = useState("");
  return <Ctx.Provider value={{ libQuery, setLibQuery, libSys, setLibSys, refPep, setRefPep }}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx)!;

/* abrir una ficha = ir a #p/<slug> (enlazable); el drawer escucha el hash */
export const openPeptide = (slug: string) => { location.hash = `p/${slug}`; };
